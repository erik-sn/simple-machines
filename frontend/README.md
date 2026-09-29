# Frontend: technology choices and packages

The frontend is a single-page React application written in TypeScript. In development Vite serves it and proxies `/api` to Django; in production the built static files are served by unprivileged nginx and the gateway routes `/api` to the backend on the same host, so there is no CORS configuration anywhere. Versions live in [package.json](package.json) and `pnpm-lock.yaml`; this page explains what each piece is for and why it is here. The end-to-end suite in [../e2e](../e2e) is documented here too because it exists to exercise this application.

## What runs

- **Development server**: Vite with hot module replacement on `127.0.0.1:5173` (`just dev-frontend`), proxying `/api` to the backend on port 8000.
- **Production build**: `pnpm --dir frontend build` emits hashed static assets into `dist/`. The frontend image copies that directory into `nginxinc/nginx-unprivileged`, which serves it on port 8080 with a client-side routing fallback, immutable caching for hashed assets, `no-cache` on `index.html`, and the security headers in `nginx.conf` (a same-origin Content-Security-Policy, `nosniff`, `Referrer-Policy`, `X-Frame-Options`). The container never proxies.
- **Configuration**: build-time only. `VITE_SENTRY_DSN` enables error tracking; the API base is always the relative `/api`.

## Framework and state

- **React** with **react-dom**: the UI library. `main.tsx` is the only file that mounts; `App.tsx` is an ordinary exported component so another repo can render it under its own router. The **React Compiler** (`babel-plugin-react-compiler` through `@rolldown/plugin-babel` and `@babel/core` in `vite.config.ts`) memoizes components and hooks at build time, so `useMemo`, `useCallback`, and `memo` are written only with a profiler measurement in hand. `main.tsx` also reloads the page once when a deploy invalidates a lazily loaded chunk (`vite:preloadError`).
- **TypeScript** in strict mode with `noUncheckedIndexedAccess`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, and the other options in `tsconfig.base.json`: the type gate. Type errors are how a backend contract change surfaces in the frontend.
- **Redux Toolkit** and **react-redux**: application state through a typed store. `store/store.ts` exposes `setupStore(preloadedState)` for tests, the app singleton, typed hooks, and `createAppSelector`. Server state lives in RTK Query; the only hand-written slice is authentication.
- **RTK Query** (part of Redux Toolkit): data fetching, caching, and invalidation. `store/baseApi.ts` owns the base query: it attaches the bearer token, times requests out at 30 s, refreshes once on 401 (concurrent 401s share a single refresh, so rotated refresh tokens are never presented twice), ends the session when the refresh fails, and refetches active queries on reconnect. `store/api.ts` is the project's API surface: the generated endpoints enhanced with per-id tags or optimistic updates, and the hooks screens import. `store/errors.ts` narrows `error.data` into the backend's one error shape (`parseApiError`, `errorMessage`).
- **react-router** (declarative mode): client-side routing. `App.tsx` holds one `<Routes>` tree under a pathless layout route (`components/AppLayout.tsx`: error boundary, one `Suspense` for the lazily loaded screens, `RouteFocus` moving focus to each screen's heading). `RequireAuth` redirects unauthenticated users to the sign-in screen and remembers where they were going.

## Application concerns

- **Generated API client**: `@rtk-query/codegen-openapi` reads the committed `backend/schema.yaml` and writes `src/store/generatedApi.ts`, a typed set of endpoints and hooks injected into `baseApi`, with a cache tag per API resource so a mutation refetches that resource's queries; untyped schema parts come out as `unknown`. Regenerate with `just api-client`; the file is never edited and CI fails when it drifts.
- **Authentication**: JWT access and refresh tokens from the backend, persisted in localStorage (`auth/tokens.ts`). `auth/logout.ts` is the one way to end a session: it clears tokens, credentials, and the query cache. The XSS tradeoff is accepted and documented in `docs/template.md`.
- **Feature flags**: `flags/useFlag.ts` reads the backend's `/api/v1/flags/` endpoint. Unknown or unloaded flags are off.
- **Tailwind CSS** through `@tailwindcss/vite`: utility-first styling with CSS-first configuration. Theme overrides go in `src/index.css`; there is no Tailwind config file.
- **i18next** and **react-i18next**: every user-facing string goes through `t()` into `src/i18n/locales/`, even while English is the only shipped language. Dates, numbers, and currency are formatted by `src/i18n/format.ts` with native `Intl` on the active language.
- **date-fns**: date arithmetic and relative time. The API speaks UTC ISO-8601; display formatting is `formatDateTime` from `src/i18n/format.ts` inside `<time dateTime>`.
- **@sentry/react**: error tracking, loaded dynamically and only when `VITE_SENTRY_DSN` is set at build time.
- **project.json**: the frontend reads the project name for the document title from the repo-root facts file; it is the only place identity comes from.

## Development tooling

- **pnpm**: the package manager for the workspace (`frontend` and `e2e`). `.npmrc` pins exact versions and `pnpm-workspace.yaml` holds new releases for seven days and blocks dependency install scripts.
- **Vite** with **@vitejs/plugin-react**: the build tool and dev server. The Vitest configuration lives in the same `vite.config.ts`. `@rolldown/plugin-babel`, `@babel/core`, and `babel-plugin-react-compiler` add the React Compiler pass on JSX/TSX files.
- **Biome**: formatting and linting in one tool, replacing eslint and prettier. `biome.base.json` is template-owned and carries the rules (React and test domains, restricted imports, the `fetch` ban outside `baseApi` and the test handlers); `biome.json` extends it and is where project rules go. `biome ci` runs in CI; pre-commit hooks format staged files. The generated client is excluded because it is deterministic codegen output.
- **TypeScript configuration**: `tsconfig.base.json` is template-owned; `tsconfig.json` extends it and owns `include` and project options.
- **Vitest** with **jsdom** and **@testing-library/react**: component and unit tests in a simulated DOM (`pnpm test`). `src/test/setup.ts` runs before every file: it registers the **@testing-library/jest-dom** matchers, starts the **msw** server (`src/test/server.ts`, default handlers in `src/test/handlers.ts`) with unhandled requests failing the test, resets handlers and localStorage after each test, and resolves relative request URLs against the document the way a browser does (Node's `Request` would reject them). `src/test/renderWithProviders.tsx` renders a component with a fresh store, a `MemoryRouter`, and i18n; **@testing-library/user-event** drives interaction. `globals: true` lets Testing Library clean up between tests automatically.
- **@types/react** and **@types/react-dom**: type definitions for the React runtime.

## End-to-end suite (`../e2e`)

- **Playwright** (`@playwright/test`): drives the real frontend against the real backend, database, and Redis. `just e2e` starts the stores, migrates, seeds an E2E user, and hands over to Playwright, which starts both dev servers itself. Traces are kept on failure and uploaded by CI.
- **@axe-core/playwright**: an accessibility scan (WCAG 2.0 A and AA, 2.1 AA) of every screen state a journey reaches, through `tests/a11y.ts`; violations fail the test.
- **TypeScript** and **@types/node**: the suite is type-checked as part of `just typecheck`.
- `tests/smoke.spec.ts` runs in frontend-only projects; `tests/journey.spec.ts` signs in and exercises the example feature end to end.

## Layout

- `src/main.tsx`: mounting, Sentry initialisation, document title, store listeners, the preload-error reload.
- `src/App.tsx`: routes, lazily loaded screens, and the store provider.
- `src/components/`: shared pieces (`AppLayout`, `ErrorBoundary`, `ErrorFallback`, `RouteFocus`, `FieldError`).
- `src/store/`: the Redux store, the auth slice, the base API, the project API surface (`api.ts`), error narrowing (`errors.ts`), and the generated client.
- `src/auth/`: token persistence, the route guard, and the logout thunk.
- `src/flags/`, `src/i18n/`: feature flags, translations, and `Intl` formatting.
- `src/pages/`: the seeded example screens. Replace them.
- `src/test/`: test setup, the MSW server and handlers, `renderWithProviders`.
- `nginx.conf`, `Dockerfile`: production serving.

## Commands

- `just dev-frontend`: Vite dev server.
- `just api-client`: regenerate the typed client after `just api-schema`.
- `just e2e`: the Playwright journey against the running stack.
- `just check`: the full gate (Biome, tsc, Vitest, drift), identical to CI.
