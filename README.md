# Simple Machines

Creating simple machines

## Getting started

```bash
mise trust && mise install
just setup      # dependencies, hooks, .env, generated API artifacts
just check      # full gate suite; CI runs the same
just e2e        # the real thing in a real browser
```

## Development

```bash
just dev-backend    # Postgres + Redis (Docker), Celery worker, Django dev server
just dev-frontend
```

`just --list` shows every recipe. After any API change, run `just api-schema` and `just api-client`; CI fails when the committed schema or generated client is stale.

## Production

The application ships as container images built from the repo root, plus a Kustomize base the fleet deploys (see [docs/fleet.md](docs/fleet.md)).

```bash
just images                     # builds <slug>-backend and <slug>-frontend
docker build -f backend/Dockerfile .
docker build -f frontend/Dockerfile .
pnpm --dir frontend build       # static assets only, into frontend/dist
```

- **Backend image**: Python slim, the locked uv environment, static files collected at build time, gunicorn on port 8000 with JSON logs. The same image runs the Celery worker and Beat with different commands.
- **Frontend image**: the Vite build served by unprivileged nginx on port 8080 with a client-side routing fallback; it never proxies. The gateway routes `/api` on the same host to the backend, so no CORS exists anywhere.
- **Configuration**: every variable in [.env.example](.env.example) is required at startup; set `ENVIRONMENT=production` (or `staging` for production-shaped settings without the name). Optional: `SENTRY_DSN`, `DJANGO_CSRF_TRUSTED_ORIGINS`, SMTP variables, and `VITE_SENTRY_DSN` at frontend build time. In Kubernetes these arrive as the `app-env` Secret.
- **Release**: merging to `main` builds each image once and pushes `sha-<short>` and `edge`. Pushing a `vX.Y.Z` tag retags that digest as the version and `latest`; `vX.Y.Z-beta.N` retags it as the version and `beta`. Nothing is rebuilt for a release.
- **Deploy**: `deploy/base` holds the Deployments, Services, and probes (`/api/v1/health/`, `/api/v1/ready/`); overlays under `deploy/overlays/` and the fleet repo own replicas, image pins, routing, and secrets. `just k8s-validate` renders every overlay.
- **Migrations**: run `python manage.py migrate` against the target database as a release step (for example from a one-off pod using the backend image). The template does not automate this.

## Orientation

- [AGENTS.md](AGENTS.md) - commands, rules, and workflow (for humans and agents).
- [docs/template.md](docs/template.md) - what every template file is; this repo is generated from the bootstrap template and receives updates from it.
- [frontend/README.md](frontend/README.md) - frontend and E2E technology choices and packages.
- [docs/fleet.md](docs/fleet.md) - how deployment works (this repo publishes images; the fleet repo hosts them).
- [docs/adr/](docs/adr/) - settled decisions.
- The `explain-repo` skill (`.claude/skills/explain-repo/`) reads all of the above and produces a full orientation for a new human or agent.
