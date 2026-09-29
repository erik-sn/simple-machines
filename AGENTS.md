<!-- template-managed (bootstrap): do not edit; project memory goes in PROJECT.md. Delete this line to take ownership. -->

# Agent guide

Identity (name, slug, registry, enabled stacks) lives in [project.json](project.json); read it first.
This repo was generated from the bootstrap template; [docs/template.md](docs/template.md) explains what every template file is and the ownership rules below.
Each stack documents its technology choices and packages in its own README (`backend/`, `frontend/`, `crates/`) and its coding conventions in its own AGENTS.md (`backend/`, `frontend/`, `e2e/`).
Read the AGENTS.md of every directory you change: Claude Code loads it when it reads a file there; Codex does not, so open it yourself.

## Commands

Everything goes through `just` (`just --list` shows all recipes); toolchains come from mise (`mise install` once per machine).

- `just setup` - dependencies, git hooks, .env, generated API artifacts.
- `just check` - the full local gate, identical to CI. Run it before declaring any task done.
- `just e2e` - Playwright against its own real stack (own Postgres, Redis, database, and ports); runs beside development.
- `just dev-backend` (Postgres and Redis in Docker, the Celery worker, the Django dev server) / `just dev-frontend` - local development; `just dev-down` stops the containers.
- `just api-schema` then `just api-client` - after any API change (drift-gated in CI).

## Hard rules

- Files whose header says "template-managed (bootstrap)" are never edited; extend via their seams (settings.py over settings_base.py, justfile over template.just, lefthook-local.yml, compose.override.yaml). Escape hatch and costs: docs/template.md.
- Generated files (backend/schema.yaml, frontend/src/store/generatedApi.ts, lockfiles) are regenerated, never hand-edited.
- Never weaken a gate (CI config, lint rules, thresholds, markers) to make a failing check pass; fix the code or raise the issue.
- API changes are contract-first: change DRF code, regenerate schema and client, fix every TypeScript error that surfaces.
- New domain models subclass core.BaseModel; new endpoints inherit deny-by-default (open endpoints opt out explicitly).
- Every major feature (anything that came out of a shaping session) ships behind a feature flag, on or off by default: declared in `<app>/flags.py`, gated at its boundary (`feature_flag` on the view, `FeatureGate` around the route), never sprinkled through logic, so features are built and switched in isolation. Retiring a flag is a shaping decision.
- User-facing frontend strings go through t() into the locale catalog; times are UTC from the API, displayed through formatDateTime (frontend/src/i18n/format.ts), never formatted ad hoc.
- Configuration is required env vars via core.env.require_env; never os.environ.get with a silent default.
- Fail loudly: a missing setting, an impossible state, a lost task, or an unexpected response raises and is seen, never swallowed, defaulted, logged at debug, or retried into silence.

## Workflow

- Architectural decisions get an ADR in docs/adr/ (format in its README); check existing ADRs before proposing structural changes.
- Expected data volume is decided at shaping: an issue that adds or reshapes a model states it. An unattended agent facing a silent issue assumes growth and records that assumption in its PR.
- Prefer reproducing bugs end to end (just e2e) before fixing.
- Work left out or deferred gets a `TODO(<issue url>)` comment where the missing code belongs, linking the GitHub issue that documents it; no issue, no deferral.
- New to the repo, or about to make a structural decision: the explain-repo skill lays out every capability from the docs.
- Quarterly upkeep: the quarterly-maintenance skill.
- Agentic workflow conventions (modes, tickets, review ceremony) are defined outside this template, per session or via the user's skills.

## Project memory

Project-specific memory (decisions in flight, quirks, anything not derivable from the code or git history) lives in [PROJECT.md](PROJECT.md) at the repo root once the project creates it; the template never generates it. Keep it under 150 lines and delete anything a tool now enforces. Claude Code loads it through the import on the next line and skips a missing file; Codex opens it after this file.

@PROJECT.md
