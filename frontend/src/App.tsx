// The application as an ordinary, importable component: routes only, no
// mounting (main.tsx owns that).
import { Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { CoverPage } from "./pages/CoverPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<CoverPage />} />
      </Route>
    </Routes>
  );
}
