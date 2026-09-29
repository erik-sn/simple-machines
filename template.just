# template-managed (bootstrap): do not edit; project recipes belong in the
# justfile that imports this. Delete this line to take ownership.
#
# The standard command surface. `just check` is the full local gate and is
# byte-identical to CI. Stack-specific recipes guard on their directory, so
# this one file works in every generated combination.

set dotenv-load := true

# Full local gate: identical to CI. Run before declaring any task done.
check: lint typecheck test drift deploy-check k8s-validate

# Install dependencies, git hooks, local env, and generated API artifacts.
setup:
    #!/usr/bin/env bash
    set -euo pipefail
    # Template dev instance only (.template-dev/ never ships): materialize the
    # dev facts file and full deploy roster so template/ runs directly.
    if [ ! -f .copier-answers.yml ] && [ -d .template-dev ]; then
        cp -f .template-dev/project.json project.json
        cp -f .template-dev/kustomization.yaml deploy/base/kustomization.yaml
    fi
    cp -n .env.example .env 2>/dev/null || true
    uv sync
    if [ -f pnpm-workspace.yaml ]; then pnpm install; fi
    if [ -f Cargo.toml ]; then cargo fetch; fi
    lefthook install
    # The chained recipes run in a fresh `just` process so dotenv-load picks
    # up the .env this recipe just created; running commands directly here
    # would inherit this process's env, resolved before .env existed.
    if [ -d backend ]; then
        just migrate seed-dev api-schema
        if [ -d frontend ]; then just api-client; fi
    fi
    echo "setup complete - see just --list"

# --- development -------------------------------------------------------------

# Postgres and Redis for this checkout (Docker compose, host ports from .env).
# Every recipe that needs them depends on it, so nothing is started by hand;
# `just dev-down` stops them. CI provides service containers instead, so the
# recipe no-ops there.
[private]
db-up:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "${CI:-}" ]; then exit 0; fi
    if [ -d backend ]; then docker compose up -d --wait db redis; fi

# Ctrl-C stops the processes; the containers stay up for the next run. The
# worker does not reload on code changes: restart the recipe, or iterate on
# tasks with `just dev-worker` in a terminal of its own. Django listens on
# BACKEND_PORT and Vite (just dev-frontend) on FRONTEND_PORT, both from .env.
# The whole backend in one terminal: Postgres and Redis, Celery worker, Django dev server.
dev-backend: db-up
    #!/usr/bin/env bash
    set -euo pipefail
    uv run --directory backend celery -A config worker --loglevel info &
    worker=$!
    trap 'kill "$worker" 2>/dev/null || true; wait "$worker" 2>/dev/null || true' EXIT
    uv run --directory backend python manage.py runserver "127.0.0.1:${BACKEND_PORT:-8000}"

dev-frontend:
    pnpm --dir frontend dev

# Run it before working in another checkout that needs the same host ports.
# Stop this checkout's dev and e2e containers (Postgres, Redis); data volumes are kept.
dev-down:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -d backend ]; then docker compose down; fi

# A Celery worker on its own (dev-backend already runs one).
dev-worker: db-up
    uv run --directory backend celery -A config worker --loglevel info

# Celery beat, the schedule's clock; dev-backend does not start it.
dev-beat: db-up
    uv run --directory backend celery -A config beat --loglevel info

# Create the development superuser (dev / dev); no-op outside ENVIRONMENT=dev.
seed-dev: db-up
    uv run --directory backend python manage.py seed_dev

migrate: db-up
    uv run --directory backend python manage.py migrate

# Always with a name and an app: `just makemigrations --name add_x example`.
makemigrations *ARGS:
    uv run --directory backend python manage.py makemigrations {{ ARGS }}

# Point it at production through the usual POSTGRES_* variables with a
# read-only role.
# Read-only Postgres health report: slow statements, index waste, dead tuples, connections.
db-audit:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d backend ]; then exit 0; fi
    uv run --directory backend python manage.py db_audit

# --- the API contract --------------------------------------------------------

# Regenerate backend/schema.yaml from the DRF code (fails on schema warnings).
api-schema:
    uv run --directory backend python manage.py spectacular \
        --file schema.yaml --validate --fail-on-warn

# The output is deterministic (the drift gate relies on that) and excluded
# from Biome.
# Regenerate the typed RTK Query client from the committed schema.
api-client:
    pnpm --dir frontend exec rtk-query-codegen-openapi openapi-config.js

# --- gates -------------------------------------------------------------------

fmt:
    #!/usr/bin/env bash
    set -euo pipefail
    ruff format .
    if [ -d frontend ]; then pnpm --dir frontend exec biome check --write .; fi
    if [ -f Cargo.toml ]; then cargo fmt --all; fi

lint:
    #!/usr/bin/env bash
    set -euo pipefail
    ruff format --check .
    ruff check .
    if [ -d frontend ]; then pnpm --dir frontend exec biome ci .; fi
    if [ -f Cargo.toml ]; then
        cargo fmt --all --check
        cargo clippy --workspace --all-targets -- -D warnings
    fi

typecheck:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -d backend ]; then uv run --directory backend mypy .; fi
    uv run --directory scripts mypy .
    for dir in packages/*/; do
        if [ -f "${dir}pyproject.toml" ]; then uv run --directory "$dir" mypy .; fi
    done
    if [ -d frontend ]; then pnpm --dir frontend exec tsc --noEmit; fi
    if [ -d e2e ]; then pnpm --dir e2e exec tsc --noEmit; fi

# Unit and integration tests; Postgres and Redis are started first (CI provides them).
test: db-up
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -d backend ]; then uv run --directory backend pytest; fi
    # Shared libraries run where their consumers do: once in the workspace, then
    # again on the oldest Python their requires-python allows (">=X.Y") with the
    # lowest versions of their direct dependencies, test tools as locked.
    for dir in packages/*/; do
        if [ ! -f "${dir}pyproject.toml" ]; then continue; fi
        uv run --directory "$dir" pytest
        name=$(sed -n 's/^name *= *"\(.*\)"/\1/p' "${dir}pyproject.toml" | head -n 1)
        floor=$(sed -n 's/^requires-python *= *">=\([0-9.]*\)"$/\1/p' "${dir}pyproject.toml")
        if [ -z "$floor" ]; then
            echo "${dir}pyproject.toml: requires-python must be \">=X.Y\" to test the floor" >&2
            exit 1
        fi
        tools=$(mktemp)
        # The trap covers a failing run; the rm below, each passing one.
        trap 'rm -f "$tools"' EXIT
        uv export --package "$name" --only-group dev --no-emit-project --no-hashes --quiet > "$tools"
        # A uv-managed floor python, fetched when missing: mise pins one python and
        # sets only-system, which hides every other release (CI has none).
        # Editable: uv caches a local directory's build by its pyproject, so a
        # plain install would test stale source.
        uv run --isolated --no-project --python-preference only-managed --python "$floor" \
            --resolution lowest-direct \
            --with-editable . --with-requirements "$tools" --directory "$dir" pytest -p no:cacheprovider
        rm -f "$tools"
    done
    if [ -d frontend ]; then pnpm --dir frontend test; fi
    if [ -f Cargo.toml ]; then cargo test --workspace --locked; fi

# Fail if generated artifacts are stale: migrations, schema, client.
drift: db-up
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d backend ]; then exit 0; fi
    # Model changes without a migration (needs the database, like the tests).
    # --noinput: a suppressed prompt exits non-zero instead of hanging CI.
    uv run --directory backend python manage.py makemigrations --check --noinput
    just api-schema
    git diff --exit-code -- backend/schema.yaml
    if [ -d frontend ]; then
        just api-client
        git diff --exit-code -- frontend/src/store/generatedApi.ts
    fi

# Django's deployment checks and the gunicorn config, under a production-shaped
# environment: the identity and host variables are overridden to look like
# production, everything else comes from .env (or the CI environment).
deploy-check:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d backend ]; then exit 0; fi
    export ENVIRONMENT=production
    export DJANGO_ALLOWED_HOSTS=app.example.com
    export DJANGO_CSRF_TRUSTED_ORIGINS=https://app.example.com
    # security.W009 wants 50+ characters; the dev and CI keys are short by design.
    export DJANGO_SECRET_KEY=deploy-check-only-key-never-used-to-sign-anything-0123456789
    uv run --directory backend python manage.py check --deploy --fail-level WARNING
    (cd backend && uv run gunicorn --check-config -c gunicorn.conf.py config.wsgi)

# Migrations on main are frozen: a modified, deleted, or renamed one fails.
# Skips when origin/main is not available (offline clone); CI fetches it.
migrations-frozen:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d backend ]; then exit 0; fi
    git fetch --quiet origin main 2>/dev/null || true
    if ! git rev-parse --verify --quiet origin/main >/dev/null; then
        echo "migrations-frozen: origin/main unavailable; skipping."
        exit 0
    fi
    changed=$(git diff --name-status origin/main...HEAD -- '*/migrations/0*.py' | grep -E '^(M|D|R)' || true)
    frozen=""
    while IFS=$'\t' read -r status path _rest; do
        [ -z "$status" ] && continue
        # A migration may leave only with its whole app: Django never loads the
        # migrations of an app that is gone, so nothing applied is rewritten.
        app_dir=$(dirname "$(dirname "$path")")
        if [ "$status" = "D" ] && ! git cat-file -e "HEAD:$app_dir" 2>/dev/null; then
            echo "migrations-frozen: $path deleted with its app ($app_dir); allowed."
            continue
        fi
        frozen+="$status	$path"$'\n'
    done <<< "$changed"
    if [ -n "$frozen" ]; then
        echo "migrations-frozen: migrations already on main were changed:" >&2
        printf '%s' "$frozen" >&2
        echo "Add a new migration instead (backend/AGENTS.md, Models and migrations)." >&2
        exit 1
    fi
    echo "migrations-frozen: ok"

# End-to-end: real browser, real backend, real database. The suite owns its
# stores (compose db-e2e and redis-e2e), its database, and its server ports
# (the E2E_* block in .env), so it runs beside `just dev-backend` in the same
# checkout. CI provides service containers on its own ports, so that block is
# skipped there.
e2e:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d e2e ]; then exit 0; fi
    if [ -z "${CI:-}" ]; then
        # mise re-applies .env through every shim, which would undo the exports
        # below; with the tools' real paths first on PATH nothing re-reads it.
        eval "$(mise env -s bash)"
        export BACKEND_PORT="${E2E_BACKEND_PORT:-8010}" FRONTEND_PORT="${E2E_FRONTEND_PORT:-5183}"
        if [ -d backend ]; then
            export POSTGRES_PORT="${E2E_POSTGRES_PORT:-5442}"
            export REDIS_URL="redis://127.0.0.1:${E2E_REDIS_PORT:-6389}/0"
            export CACHE_REDIS_URL="redis://127.0.0.1:${E2E_REDIS_PORT:-6389}/1"
            docker compose up -d --wait db-e2e redis-e2e
        fi
    fi
    if [ -d backend ]; then
        uv run --directory backend python manage.py migrate
        uv run --directory backend python manage.py seed_e2e
    fi
    pnpm --dir e2e exec playwright install chromium
    pnpm --dir e2e test

# Verify template-managed files still match the recorded template version.
template-check:
    uv run python tools/template_check.py

# --- i18n --------------------------------------------------------------------

# Extract and compile translations (requires gettext installed).
i18n:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d backend ]; then exit 0; fi
    cd backend
    uv run python manage.py makemessages --all --ignore .venv
    uv run python manage.py compilemessages

# --- delivery ----------------------------------------------------------------

# Build every container image (from the repo root: workspace context).
images:
    #!/usr/bin/env bash
    set -euo pipefail
    slug=$(jq -r .slug project.json)
    if [ -d backend ]; then docker build -f backend/Dockerfile -t "$slug-backend" .; fi
    if [ -d frontend ]; then docker build -f frontend/Dockerfile -t "$slug-frontend" .; fi

# Validate every Kustomize overlay renders.
k8s-validate:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d deploy ]; then exit 0; fi
    kustomize build deploy/overlays/dev > /dev/null
    kustomize build deploy/overlays/prod > /dev/null
