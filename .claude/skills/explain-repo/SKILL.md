---
name: explain-repo
description: Explain what this repository can do - stacks, commands, gates, delivery, automation, and the template relationship - by reading its own documentation and producing one concise orientation. Use when someone (human or agent) is new to the repo, asks what it does or how it works, or before making a structural decision.
---

<!-- template-managed (bootstrap): do not edit. Delete this line to take ownership. -->

# Explain this repository

The repo's capabilities are broad and easy to underestimate; decisions made without knowing them are usually wrong. Read the sources below, then write the orientation. Read, do not skim: the answer must come from the files, not from what a Django or React repo usually looks like.

## Sources (read every one that exists, in this order)

1. `project.json` - identity and which stacks are enabled. Skip sections for disabled stacks.
2. `AGENTS.md` - commands, hard rules, project notes; then `backend/AGENTS.md`, `frontend/AGENTS.md`, `e2e/AGENTS.md` - the per-stack coding conventions.
3. `docs/template.md` - the template relationship, file ownership, extension seams, topology, sanctioned upgrades.
4. `backend/README.md`, `frontend/README.md`, `crates/README.md` - technology choices and notable packages per stack.
5. `template.just` and `justfile` - the real command surface; report what the recipes do, not just their names.
6. `mise.toml`, `rust-toolchain.toml` - toolchains and how they are pinned.
7. `.github/workflows/*.yml` - what CI gates, how images publish and promote, dependency automation, vulnerability scanning.
8. `renovate.json5`, `pnpm-workspace.yaml`, `deny.toml` - dependency and supply-chain policy.
9. `deploy/` and `docs/fleet.md` - what the app ships and who deploys it.
10. `docs/adr/` - settled decisions; list titles and status, summarise any that constrain the question at hand.
11. `.env.example` - the configuration contract.

## Output

Write one message, concise but complete, in this order. Prefer short bullets; name the file where a reader would go deeper. State what is present and configured, and say plainly when something is wired but inert (Sentry, django-storages, email) or deliberately absent (CORS, Helm, routing).

1. **Identity**: name, slug, registry, enabled stacks, one line on what the app does.
2. **Architecture**: the processes that run (API, worker, beat, SPA, Rust) and the stores they use; the `/api` same-host topology.
3. **Stacks**: for each enabled stack, the framework, the notable packages and what each is for, and the dev tooling. Keep it to the choices that shape how code is written.
4. **Cross-cutting capabilities**: auth and deny-by-default, contract-first API and the generated client, feature flags, i18n, UTC, logging, configuration by required env vars, the example slice.
5. **Command surface**: the `just` verbs grouped by purpose, with the one-line meaning of each.
6. **Gates**: what `just check` runs, what CI adds (E2E, images, kustomize), the pre-commit hooks, and which gates enforce which rule so nobody writes a prose rule for something a tool already checks.
7. **Delivery**: images, publish on merge, promote by tag, `deploy/base`, the fleet's responsibilities versus this repo's, the probes.
8. **Automation**: Renovate policy (cooldown, fast lane, majors on the dashboard), osv-scan, GHCR cleanup, the copier update path, and what secrets or settings they need to actually run.
9. **Template relationship**: template-owned versus seeded versus generated, the extension seams, the takeover escape hatch and its cost.
10. **Decisions on record**: the ADR list, one line each.
11. **Sanctioned upgrades and known tradeoffs**: from `docs/template.md` (storage, admin, WebSockets, and so on) and tokens in localStorage.

Close with anything that looks broken, stale, or contradictory between the documents and the code (a command AGENTS.md names that does not exist, a workflow that needs a secret that is not documented). Do not fix anything; this skill only explains.
