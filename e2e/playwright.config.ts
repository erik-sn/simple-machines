// template-managed (bootstrap): do not edit; project scenarios go in tests/.
// Delete this line to take ownership.
// Run through `just e2e`: it starts the suite's own Postgres/Redis, migrates,
// seeds (seed_e2e), then hands over to Playwright, which starts the app
// servers itself below on the suite's own ports (BACKEND_PORT, FRONTEND_PORT,
// exported by the recipe from the E2E_* block in .env), so a running
// `just dev-backend` is neither reused nor disturbed. The suite drives the
// real frontend against the real backend - the template's proof that the
// generated application actually works.
import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Frontend-only projects have no backend to start; the smoke spec still runs.
const hasBackend = existsSync("../backend");
const backendPort = process.env.BACKEND_PORT ?? "8000";
const frontendPort = process.env.FRONTEND_PORT ?? "5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: "retain-on-failure",
  },
  webServer: [
    ...(hasBackend
      ? [
          {
            command: `uv run --directory ../backend python manage.py runserver 127.0.0.1:${backendPort}`,
            url: `http://127.0.0.1:${backendPort}/api/v1/health/`,
            // Never reuse: whatever already listens there is another
            // checkout's server or a stale one, and the suite would test the
            // wrong code. A taken port fails loudly instead.
            reuseExistingServer: false,
            timeout: 60_000,
          },
        ]
      : []),
    {
      // Vite is started directly, not through `pnpm run dev`: since pnpm
      // 11.27.1 / 12.6.0, `pnpm run` intercepts termination signals and
      // waits for the script to shut down, which detaches Vite from the
      // process group Playwright kills at teardown and hangs the run forever.
      // It reads FRONTEND_PORT and BACKEND_PORT itself (vite.config.ts).
      command: "node_modules/.bin/vite",
      cwd: "../frontend",
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
