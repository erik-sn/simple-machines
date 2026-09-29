<!-- template-managed (bootstrap): do not edit. Delete this line to take ownership. -->

# About this repository's template files

This project was generated from the bootstrap template.
This page explains what that means, what every non-obvious file is for, and how to work with (or escape from) the template.
The authoritative per-file map is [template-manifest.json](../template-manifest.json); this page is the human explanation.

## How the template relationship works

- [.copier-answers.yml](../.copier-answers.yml) records which template version this project came from; never edit it by hand.
- Template improvements arrive as `copier update` runs, usually opened as PRs by Renovate's copier manager when the template tags a new release.
- [project.json](../project.json) is the facts file: name, slug, GitHub owner, registry, enabled stacks.
It is the only file the template renders with project identity; everything else reads facts from it (Django settings, the frontend title, image names, workflows).

## File ownership

Every template file has a class in the manifest:

- **template-owned**: never edit these; they update cleanly through `copier update`.
Each carries a marker line ("template-managed (bootstrap)"), and CI (`just template-check`) verifies they still match the recorded template version.
- **seeded**: generated once, then completely yours (all real project code); `copier update` never touches them again.
- **identity**: rendered from your answers at generation time.
- **generated**: written by tools (`schema.yaml`, `generatedApi.ts`, lockfiles), enforced by drift gates - regenerate, never hand-edit. `.gitattributes` marks them `linguist-generated`, so GitHub collapses them in pull request diffs.

**Extension seams** exist so you never need to edit template-owned files: `config/settings.py` imports `settings_base.py` and overrides; the `justfile` imports `template.just` and adds recipes; `frontend/biome.json` and `frontend/tsconfig.json` extend the template-owned `biome.base.json` and `tsconfig.base.json`; `frontend/src/store/api.ts` refines the generated client (`enhanceEndpoints`) and is where screens import hooks from; `<app>/services.py` holds each app's business logic; `lefthook-local.yml`, `compose.override.yaml`, and `.mise.local.toml` layer on their template-owned counterparts; `renovate.json5` has a marked section for project rules.

**The escape hatch (takeover)**: if you truly must edit a template-owned file, delete its marker line (for JSON files, add the path to `template_takeovers` in project.json) and say why in the commit message.
CI then reports the file as taken over and stops comparing it.
The cost: future `copier update` runs may conflict on that file, and it stops receiving template fixes.

## Why do I have these files?

- **A README in `backend/`, `frontend/`, and `crates/`**: each stack's technology choices and notable packages, seeded so the project grows them; the `explain-repo` skill reads them together with this page to orient a new human or agent.
- **`backend/core/` infrastructure modules**: `exceptions.py` renders every non-2xx response in one JSON shape (`{type, errors: [{code, detail, attr}]}`) and documents it in the schema; `checks.py` turns the modeling and Celery rules in `backend/AGENTS.md` into startup errors (`manage.py check`); `middleware.py` adds a request id to every log line and cache headers to `/api/`; `filters.py` makes every ordering total (`-id` tiebreaker); `pagination.py` caps page sizes; `cache.py` has the stampede-safe `cached_or_compute`; `deletion.py` and the `DeletedRecord` model replace soft delete; `validators.py` holds the JSON shape validators every `JSONField` declares; `flags.py` and `signals.py` are the feature-flag machinery (below). All template-owned; extend by subclassing or calling, never by editing.
- **`frontend/src/store/errors.ts`, `src/i18n/format.ts`, `src/auth/logout.ts`, `src/flags/`, `src/test/`**: the typed error narrowing for the one error shape, locale-aware date and number formatting, the logout thunk that also clears the query cache, the feature-flag hook and route gate, and the test helpers (`renderWithProviders`, MSW server and setup). Template-owned except `src/test/handlers.ts`, which holds your project's default request handlers.
- **`just deploy-check`, `just migrations-frozen`, `just db-audit`**: Django's deployment checklist under a production-shaped environment (part of `just check`), the CI guard that merged migrations are never edited, and the monthly database audit (hot statements, unused indexes, tables past ten indexes, dead tuples, connections).
- **An `AGENTS.md` (plus a `CLAUDE.md` importing it) in `backend/`, `frontend/`, and `e2e/`**: the coding conventions for that stack, template-owned so every generated project holds the same opinions. Claude Code loads them when it reads a file there; Codex needs the root AGENTS.md's instruction to open them. The root AGENTS.md is template-owned too; project-specific memory goes in `PROJECT.md` at the root, a file the template never generates and the root AGENTS.md imports when it exists.

- **A `pyproject.toml` in a frontend-only project**: `scripts/` is always a uv workspace member - every project gets a Python scripting area, and shared Python libraries can live under `packages/`.
- **`mise.toml` pins tools for stacks you did not enable**: deliberate simplicity; unused pins cost install time only.
- **`template.just` recipes for absent stacks**: they no-op via directory guards, so the command surface is identical across projects.

## The topology (and CORS)

The frontend always calls relative `/api`: the Vite dev server proxies it to Django (see `frontend/vite.config.ts`), and in production the gateway routes `/api` on the same host to the backend Service.
There is therefore **no CORS configuration anywhere, in any environment** - do not add a CORS package; if you think you need one, the topology is being violated (different hosts for app and API).

Configuration is environment variables, all **required** (`core/env.py`): a missing variable fails at startup by name. Redis is one instance behind two URLs: `REDIS_URL` (Celery broker and results, database 0) and `CACHE_REDIS_URL` (Django cache, database 1); every cache key carries a TTL because the instance runs `noeviction` for the broker's sake. Every request is one database transaction (`ATOMIC_REQUESTS`; probes opt out), the web process runs a 10 s `statement_timeout` under the gateway's 15 s request timeout, and migrations run from an init container on the backend Deployment before the app container starts.
Local values live in `.env` (copied from `.env.example` by `just setup`, loaded by mise and just); CI sets them in the workflow; deployments use the `app-env` Secret.
Compose binds Postgres and Redis to the host ports in `.env` (`POSTGRES_PORT`, `REDIS_PORT`), Django and Vite listen on `BACKEND_PORT` and `FRONTEND_PORT`, and `just e2e` runs on its own block (`E2E_*`: the compose services `db-e2e` and `redis-e2e`, a separate database, separate server ports), so the suite runs beside `just dev-backend` and parallel checkouts on one machine each take their own block; `just dev-down` stops a checkout's containers when you move on.

Auth tokens live in localStorage: the standard SPA tradeoff (readable by successful XSS) accepted for simplicity; the access token is short-lived and refresh is rotated.

Environments are named by the required `ENVIRONMENT` variable (`dev` | `staging` | `production`): `DEBUG` is derived from it (dev only, never set independently), staging is production-shaped, and Sentry tags events with it.
Local logins: `just setup` creates a development superuser `dev` / `dev` via the `seed_dev` management command.
The command is a no-op unless `ENVIRONMENT=dev`, so the credentials cannot reach staging, production, or CI databases; the E2E user comes from `seed_e2e` (seeded, yours to grow) and lives in the suite's own database.

## Feature flags

Every major feature ships behind a flag, even one that is on from day one (root AGENTS.md, bootstrap ADR 0025): the gate forces the feature to have a boundary (its endpoints, its route) and lets unfinished work merge dark.
An app declares its flags in `<app>/flags.py` (`FLAGS = {"notes": True}`); `just migrate` creates the missing django-waffle rows with those defaults and never touches existing rows, so a toggle made in the admin (Flags) survives deploys.
Server side a view sets `feature_flag = "notes"` and `core.flags.FeatureFlagGate` (in the default permission classes) answers 404 while it is off; the frontend wraps the route in `FeatureGate` and reads inline toggles with `useFlag`, both from `/api/v1/flags/`; a missing or unloaded flag is off.
The example app shows both: `notes` gates the feature itself (on by default) and `example-banner` is an off-by-default toggle.

## Delivery contract

The app publishes; the fleet deploys (see [fleet.md](fleet.md)).
This repo's obligations: images build from the repo root (`just images`), merge to main publishes `sha-<short>` + `edge` tags, a `vX.Y.Z[-pre]` git tag promotes the already-built digest (never rebuilds), and `deploy/base` stays a valid kustomize base with no routing in it.
Routing, namespaces, image pins, and whether this app is hosted at all belong to the fleet repo.

## Sharing code between repos

- **Python**: put shared libraries in `packages/<name>` (the workspace glob picks them up). `just typecheck` runs each one's mypy and `just test` its pytest, then its tests again on the oldest Python its `requires-python = ">=X.Y"` allows with the lowest versions of its direct dependencies, so the floor it declares is the floor it is tested on. Its dev dependency group holds pytest and whatever its tests need; its ruff and mypy settings go in its own pyproject (`[tool.ruff] extend = "../../ruff.toml"` plus its `target-version`).
Other repos consume them with uv git sources: `{ git = "...", tag = "<name>-vX.Y.Z", subdirectory = "packages/<name>" }` - no registry needed, Renovate bumps tags.
- **TypeScript/React**: shared JS lives in its own small repo shipping raw TS source (`exports` pointing at `src/`, `react` in `peerDependencies`), consumed as `github:<owner>/<repo>#semver:^X.Y.Z`.
Do not use a `packages/` corner of this repo for JS (pnpm neither builds nor lets Renovate update subdirectory git deps).
Tailwind note: a shared package must ship a CSS entry with `@source` directives at its own files, and the consumer imports it, or its classes generate no styles.
- **This app as an importable page**: `App` is an ordinary exported component (mounting lives only in `main.tsx`), so another repo can render it under its own router; nested-route paths and API proxying are per-case work.
- **Git submodules**: last resort, only for tight cross-repo co-development; they sit outside lockfiles, peer resolution, and most of Renovate.

## Sanctioned upgrades (documented paths, deliberately not defaults)

- Admin facelift: `django-unfold` (one INSTALLED_APPS line) if the CSS-variable theme (`backend/static/admin-theme.css`) is not enough.
- Object storage: switch the `default` storage backend to django-storages (installed; see the comment in `settings_base.py`).
- Spec-driven development: `openspec init` when this project graduates to it; the workflow layer (outside this template) says when.
- WebSockets (Channels), RabbitMQ, GitHub Packages npm publishing, Temporal (dates): all reasonable per-project additions; none belong to the template.

## Maintenance

`just check` is the whole local gate and identical to CI.
Quarterly upkeep is the `quarterly-maintenance` skill (`.claude/skills/`): drain the Renovate dashboard, pull the template update, bump toolchains, sweep CVEs, prune, audit AGENTS.md.
