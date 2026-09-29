<!-- template-managed (bootstrap): do not edit. Delete this line to take ownership. -->

# Shared Python packages

Each directory here is a Python library that other repos can install, and a uv workspace member (the root `pyproject.toml` globs `packages/*`). `just typecheck` and `just test` gate every package. The tests run in the workspace, then again on the oldest Python its `requires-python = ">=X.Y"` allows with the lowest versions of its direct dependencies. The backend image copies this directory, so the backend can depend on a package with `{ workspace = true }`.

Layout, configuration, and how other repos consume a package by git tag: [docs/template.md](../docs/template.md). This README keeps the directory present for the image build when no package exists yet.
