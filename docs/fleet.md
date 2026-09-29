<!-- template-managed (bootstrap): do not edit. Delete this line to take ownership. -->

# The fleet: how these apps get hosted

Deployment composition lives OUTSIDE this repo, in a single infrastructure repo (the "fleet") that decides which apps run, at which version, behind which routes, on which cluster.
This app only publishes artifacts (images + `deploy/base`); it never knows whether or where it is hosted.
This page is the reference architecture for that fleet repo, researched and decided alongside the template (2026-08); build it once, by hand.

## Stack

- **Flux** (CNCF-graduated) as the GitOps controller: pull-based (works behind NAT, only read tokens in-cluster), `prune: true` makes "delete the entry" equal "undeployed", plain-YAML surface for agents. ~300MB of controllers.
- **Gateway API with Envoy Gateway** (ingress-nginx is retired): one shared `Gateway`, a wildcard listener (`*.sandbox.<domain>`) with a cert-manager DNS-01 wildcard certificate plus per-domain listeners for real sites; external-dns for non-wildcard records.
- **Renovate on the fleet repo** does all version bumps: its flux manager updates `GitRepository.ref.tag`, a regex rule updates image pins, grouped one PR per app.
- **SOPS + age** for secrets (encrypted in git, decrypted by kustomize-controller with the one in-cluster age key).

## Layout

```
fleet/
├── clusters/<cluster>/
│   ├── flux-system/          # flux bootstrap output
│   ├── platform.yaml         # Kustomization -> platform/
│   └── apps.yaml             # Kustomization -> envs/<cluster>/, prune: true
├── platform/                 # Envoy Gateway, cert-manager (+ClusterIssuer),
│   │                         # the shared Gateway, external-dns,
│   └── sandbox-shared/       # small shared Postgres + Redis for toy apps
├── envs/<cluster>/
│   └── kustomization.yaml    # THE roster: one resource line per deployed app
└── apps/<app>/
    ├── source.yaml           # GitRepository @ the app's release tag
    └── <cluster>/
        ├── release.yaml      # Flux Kustomization: path deploy/base,
        │                     #   images: [tag@digest], patches, prune: true
        ├── namespace.yaml    # namespace per app instance (+quota if sandbox)
        ├── httproute.yaml    # the app's hostname(s) - routing lives HERE
        └── secrets.enc.yaml  # app-env Secret (SOPS)
```

Deploy an app: copy an app dir, edit ~6 values, add one roster line.
Undeploy: delete the roster line; prune removes the namespace and contents.
Rollback: `git revert` the bump PR.
Fleet CI renders every env with `kustomize build`/`flux build` so a broken PR fails before the cluster sees it.

## Conventions

- Namespace per app instance (`<slug>-prod`, `<slug>-sandbox`); ResourceQuota + LimitRange on every sandbox namespace; a prod PriorityClass so toys are evicted first under pressure.
- One cluster for prod + sandbox at solo scale (DigitalOcean: free control plane, one node pool, ONE shared LB behind Envoy for the whole fleet).
- Databases: prod apps use managed Postgres; toys share the in-cluster sandbox Postgres/Redis (one database per app) - either way the app just reads `POSTGRES_*`, `REDIS_URL`, and `CACHE_REDIS_URL` from its Secret (the full key list is in the contract below).
- Image references pin `tag@digest`; the mutable `edge`/`latest`/`beta` pointers are for humans only.
- Sandbox entries may track prereleases (Renovate `ignoreUnstable: false` per package rule) for continuous deployment of toys.
- Private images need one imagePullSecret (`read:packages` PAT) per cluster; public images need nothing and cost nothing on GHCR.

## Contract the fleet must satisfy

The app stays fleet-ignorant, so everything below is an assumption the manifests and settings make about their environment, with the reason so the fleet can trade it off knowingly.
One line each; the settings that consume these live in `backend/config/settings_base.py`, the manifests in `deploy/base/`.

### The app-env Secret

Every key is required unless marked optional (`core/env.py` fails at startup by name).
`STATEMENT_TIMEOUT_MS` is deliberately not a Secret key: the backend Deployment sets it itself (10 s for the web process, 0 for the migration init container; worker and beat leave it unset), because the timeout belongs to the process role, not the environment.

- `DJANGO_SECRET_KEY` - signs sessions, CSRF tokens, and password-reset links; rotating it logs every browser session out.
- `ENVIRONMENT` - `staging` or `production`; `dev` turns on DEBUG and the dev superuser, so it never leaves a laptop.
- `DJANGO_ALLOWED_HOSTS` - comma-separated; must include every HTTPRoute hostname the API is served on, or Django answers 400.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - the app's own database on the managed (prod) or sandbox-shared (toy) Postgres.
- `REDIS_URL` - Celery broker and result backend, database `/0` (`redis://host:6379/0`).
- `CACHE_REDIS_URL` - Django cache, database `/1` on the same instance (`redis://host:6379/1`); a separate database so `cache.clear()` (FLUSHDB) can never flush the broker, and a separate URL so the second-instance upgrade below is a Secret edit, not a code change (ADR 0022).
- `DJANGO_CSRF_TRUSTED_ORIGINS` (optional) - comma-separated `https://` origins allowed to POST to Django-rendered forms (the admin) from a host other than the request's own; empty when app and API share a host, which the topology assumes.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` (optional) - SMTP; unset means sending fails loudly, by design.
- `SENTRY_DSN` (optional) - error tracking is wired but inert until set; adopting Sentry is a deferred decision, so the fleet sets nothing today.

### Redis

- Provision `maxmemory-policy noeviction` with an explicit `maxmemory` and AOF `appendfsync everysec`: the broker cannot tolerate eviction (an evicted message is a silently lost task), so the cache lives under the same policy and carries a TTL on every key; `everysec` bounds a crash to about one second of accepted tasks.
- `noeviction` turns memory pressure into write errors (task publishes fail with OOM) instead of silent loss: alert on `used_memory` against `maxmemory`; numbered databases give FLUSHDB scope, not memory isolation, so a runaway cache starves the broker.
- The documented upgrade, once a project measures a real cache footprint, is a second instance for the cache (`allkeys-lru`, no persistence) behind `CACHE_REDIS_URL`; the broker instance keeps `noeviction` and AOF, and nothing in the app changes (ADR 0022).
- Queue depth (`LLEN default`) is the worker's health signal; the worker Deployment ships no probes because `celery inspect ping` is a CPU and hang trap under load.

### Gateway (Envoy Gateway on Gateway API)

HSTS, compression, HTTP/2, and request ids are the gateway's job (ADR 0023); Django does none of them, so a fleet that omits one gets a slower or less secure app, never a broken one.

- Compress `application/json` (with the text types) at the gateway via a `BackendTrafficPolicy`; Django never compresses (`GZipMiddleware` costs Python CPU per response and pads for BREACH the JWT API does not need), and Envoy strips strong ETags when it compresses.
- Forward a client-supplied `X-Request-ID` or generate one: the backend logs it on every line and in gunicorn's access log, so it is the only correlation between the gateway log, the app log, and a user report.
- HTTPRoute `timeouts.request: 15s` (Envoy's default), under the backend's 30 s gunicorn timeout and over the web process's 10 s `statement_timeout`: the ladder makes the database the first layer to give up, so a slow query becomes a visible 500 instead of a worker held after the client already got a 504.
- Upstream idle timeout below gunicorn's 75 s `keepalive`: the client side (Envoy) must close idle connections first, or requests land on a connection gunicorn has just closed and fail with a reset.
- HSTS on every host via a response header modifier: Django's `security.W004`/`W005`/`W021` checks are silenced for this reason, so a fleet without it leaves the header absent on the API and the SPA alike.
- No retries on write routes (`POST`, `PUT`, `PATCH`, `DELETE`): the app has no idempotency keys by default, so a retried write is a duplicated write.
- HTTP/2 and TLS terminate at the gateway; gunicorn speaks HTTP/1.1 and `SECURE_PROXY_SSL_HEADER` trusts `X-Forwarded-Proto` from whatever reaches the pod.
- A NetworkPolicy admitting only the gateway's namespace to the backend Service: the `X-Forwarded-*` trust above (proto for cookie security, for-header for throttling) is safe only if nothing else can reach the pod.

### Migrations

- The backend Deployment applies migrations in an init container (`migrate --plan && migrate --noinput`), and worker and beat block on `migrate --check` until it has (ADR 0020): at one replica it is the single runner, and a failed migration leaves the previous pod serving with the rollout visibly stuck.
- The upgrade, once the fleet has a pipeline that can sequence steps (a Flux `Kustomization` holding the Job that the app's release `dependsOn`, or a CD tool with hooks), is a migration Job that completes before the Deployment rolls; it is required before the backend runs more than one replica unless the init container gains an advisory lock.

### Postgres

- Connection cap: one per gunicorn thread (backend pods x 2 workers x 4 threads = 8 per pod), one per Celery child plus the parent (concurrency 2, so 3), one for the migration init container while it runs, plus headroom for `just db-audit` and the provider's own; size `max_connections` (or the plan tier) to that sum and revisit it whenever replicas or worker counts change.
- `pg_stat_statements` available: `just db-audit` reads it to find the slow and frequent queries the index rule is judged against; a provider that hides it leaves the audit blind.
- Pooler mode: the app holds persistent connections (`CONN_MAX_AGE`) and uses server-side cursors, which a transaction-mode pooler (PgBouncer, a provider connection pool) breaks; either the pooler runs in session mode or the app is configured for transaction mode (`CONN_MAX_AGE=0`, `DISABLE_SERVER_SIDE_CURSORS=True`), never a silent mix.
