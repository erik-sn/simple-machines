# Project memory

Hobby project, not production facing. Where a rule here conflicts with the ceremony in AGENTS.md or a stack AGENTS.md, this file wins; the template's gates (lint, typecheck, template-check) still run as they are.

## Testing (decided 2026-09-29)

- No unit or component tests. Do not write Vitest tests for new code and do not ask for them in review.
- Coverage is Playwright journeys in `e2e/tests/`: one per user goal against the real app, per `e2e/AGENTS.md`.
- The seeded tests leave with the seeded pages when those are replaced. The template-owned tests stay: the ownership gate reports a deleted template-owned file as divergence, so removing them needs a template change first.

## Stack

- Frontend only, no backend (project.json). The seeded login and notes pages, auth, feature flags, and the generated API client all assume one and cannot work here; replace them rather than build on them.
