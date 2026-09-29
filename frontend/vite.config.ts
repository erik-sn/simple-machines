// Taken over from the template: no API proxy and no Vitest block, because this
// is a static site with no backend and no unit tests (PROJECT.md).
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // The dev-server port comes from the repo .env (FRONTEND_PORT), the process
  // environment taking precedence: `just e2e` exports its own block so the
  // suite runs beside development. Vite runs with frontend/ as its cwd, so
  // ".." is the repo root.
  const env = loadEnv(mode, "..", "");
  const frontendPort = Number(env.FRONTEND_PORT ?? "5173");
  return {
    plugins: [
      react(),
      // React Compiler: the compiler memoizes, so a manual useMemo,
      // useCallback, or memo needs a profiler measurement in the change.
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      // Bind IPv4 explicitly so the E2E suite's health poll (127.0.0.1)
      // reaches it; fail instead of drifting to another port.
      host: "127.0.0.1",
      port: frontendPort,
      strictPort: true,
    },
  };
});
