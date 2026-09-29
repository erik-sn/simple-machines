// The application as an ordinary, importable component: routes and store
// provider, no mounting (main.tsx owns that). Other repos can render <App />
// under their own router - see docs/template.md, "sharing code".
import { lazy } from "react";
import { Provider } from "react-redux";
import { Navigate, Route, Routes } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./components/AppLayout";
import { FeatureGate } from "./flags/FeatureGate";
import "./i18n";
import { store } from "./store/store";

// Screens are code-split; `.then` keeps their named exports.
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const NotesPage = lazy(() =>
  import("./pages/NotesPage").then((m) => ({ default: m.NotesPage })),
);

export function App() {
  return (
    <Provider store={store}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/login" element={<LoginPage />} />
          {/* Every major feature sits behind a flag at its entry point
              (AGENTS.md); notes is on by default (example/flags.py). */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <FeatureGate flag="notes">
                  <NotesPage />
                </FeatureGate>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Provider>
  );
}
