// template-managed (bootstrap): do not edit; project additions belong in the
// marked section below or take ownership by deleting this line.
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Dev-server ports come from the repo .env (BACKEND_PORT, FRONTEND_PORT),
  // the process environment taking precedence: `just e2e` exports its own
  // block so the suite runs beside development. Vite runs with frontend/ as
  // its cwd, so ".." is the repo root.
  const env = loadEnv(mode, "..", "");
  const backendPort = env.BACKEND_PORT ?? "8000";
  const frontendPort = Number(env.FRONTEND_PORT ?? "5173");
  return {
    plugins: [
      react(),
      // React Compiler (ADR 0021): the compiler memoizes, so a manual useMemo,
      // useCallback, or memo needs a profiler measurement in the change. The
      // Babel pass runs only on JSX/TSX files (the preset's own filter); every
      // other file stays on the native oxc transform.
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      // Bind IPv4 explicitly: the default ("localhost") follows the machine's
      // DNS order and can bind IPv6-only (::1) on CI runners, which the E2E
      // suite's IPv4 health poll (127.0.0.1:5173) never reaches.
      host: "127.0.0.1",
      port: frontendPort,
      // Fail instead of drifting to the next free port: the E2E suite and the
      // proxy below rely on the configured numbers.
      strictPort: true,
      // The frontend always calls relative /api; in dev Vite proxies to Django,
      // in production the gateway routes /api to the backend Service. No CORS in
      // any environment - see docs/template.md.
      proxy: {
        "/api": `http://127.0.0.1:${backendPort}`,
      },
    },
    test: {
      environment: "jsdom",
      // Exposes afterEach globally so @testing-library/react auto-cleans the
      // DOM between tests; imports in test files stay explicit.
      globals: true,
      // jest-dom matchers, the MSW server, and storage reset for every file.
      setupFiles: ["src/test/setup.ts"],
      // Rendered dates are asserted literally; pin the zone tests run in.
      env: { TZ: "UTC" },
    },
  };
});
