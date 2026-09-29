---
name: quarterly-maintenance
description: Run the quarterly maintenance pass - pull the template update, drain Renovate majors from the dashboard, bump toolchains, sweep CVEs, prune dead dependencies, audit AGENTS.md.
---

<!-- template-managed (bootstrap): do not edit. Delete this line to take ownership. -->

# Quarterly maintenance

Work through the steps in order; verify each with `just check` before moving on.
Stop for user judgment on major framework upgrades and anything that changes behavior.

## 1. Template update

- Merge the open Renovate copier PR, or run `copier update --skip-answered`.
- Resolve inline conflict markers (the pre-commit hook blocks committing them), run `just check` and `just template-check`, commit.

## 2. Drain the Renovate dashboard

- Merge open grouped minor/patch PRs (green CI only; investigate failures, never force).
- Tick major approvals on the Dependency Dashboard issue one at a time (`gh issue edit` on the checkbox line).
- For each major PR: read the changelog, apply code migrations, run `just check`, merge before approving the next.

## 3. Toolchains

- Compare `mise.toml` pins against `mise latest <tool>` and bump what Renovate missed.
- Bump `rust-toolchain.toml` to current stable if present.
- New LTS lines (Node, Python, Django) are a user decision; raise them, do not just take them.

## 4. CVE sweep

- Review GitHub Security alerts and the latest osv-scan workflow run.
- Anything without an upstream fix: pin around it or add a documented temporary ignore, plus an issue to remove it.

## 5. Prune and tidy

- `uv tree` and `pnpm why` on anything suspicious; remove dependencies nothing imports.
- `pnpm dedupe` if the lockfile has drifted into duplicates.
- Re-review ignore lists (cargo-deny, osv, ruff noqa) and drop stale entries.

## 6. Audit agent memory

- Read `AGENTS.md` and each stack's `AGENTS.md` (`backend/`, `frontend/`, `e2e/`): delete rules whose convention changed, rules a tool now enforces, and anything discoverable from code. The stack files are template-owned, so a change to them goes upstream.
- Execute every command they name and fix the ones that fail.
- Confirm the root file is still under 150 lines.
