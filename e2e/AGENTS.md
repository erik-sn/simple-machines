<!-- template-managed (bootstrap): do not edit. Project scenarios live in tests/. Delete this line to take ownership. -->

# E2E conventions

Playwright against the real frontend, backend, Postgres, and Redis (`just e2e` starts everything on the suite's own stores, database, and ports, beside a running `just dev-backend`). A journey proves the product works for a user against the real stack; it is written as the user would describe it, independent of every other journey, and never repeats what a component test already proves. `tests/journey.spec.ts` is the reference.

- Locate by accessible name (`getByRole`, `getByLabel`, `getByText`), the same names the components render through `t()`; never CSS or XPath selectors. Wait with `expect(...).toBeVisible()` or a URL or response expectation, never `waitForTimeout`.
- Fixed data comes from `backend/core/management/commands/seed_e2e.py` (idempotent `get_or_create`); a journey that needs new data extends the seed. Data a test creates through the UI must survive re-runs against the same database: unique titles per run, or clean up.
- Each test is independent: it signs in itself (or through a shared `storageState` fixture in `tests/`) and passes alone and in any order. One journey per user goal; `smoke.spec.ts` stays backend-free so frontend-only projects pass.
- A journey asserts the outcome the user sees (`toBeVisible`, the URL, the row still present after a reload), never a request count, a store action, or a response body; after a mutation wait for the refetched content, not for the response.
- Each screen state a journey reaches gets one axe scan: `expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([])`; a rule disabled with `disableRules` carries a comment naming the false positive.
- One journey per user goal across the real backend (sign in, create, see it persisted); loading, validation, and empty states belong to the component tests in `../frontend`, not here.
- `playwright.config.ts` is template-owned; fixtures and helpers live in `tests/`.
