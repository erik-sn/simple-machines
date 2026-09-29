# 0001 - This project is generated from the bootstrap template

Status: accepted
Decided by: user

## Context

Independent single-author repos drift apart and rot individually unless structure, tooling, and maintenance policy are shared.

## Decision

This project was generated from the bootstrap Copier template and stays connected to it: `.copier-answers.yml` records the version, template updates arrive via `copier update` (usually as Renovate PRs), and template-owned files are never edited locally (see `docs/template.md` for the ownership model and its escape hatch).

## Consequences

- Structural conventions (commands, CI shape, Renovate policy, delivery contract) come from the template; improve them upstream rather than diverging locally, unless the divergence is genuinely project-specific (then: takeover, with the reason committed).
- Resolve template-update PRs promptly; a project that skips updates for a year gets one painful merge instead of four easy ones.
- The template repo's ADRs document the reasoning behind the inherited structure.
