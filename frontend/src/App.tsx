// The application as an ordinary, importable component: routes only, no
// mounting (main.tsx owns that).
import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/AppLayout";
import { ChapterPage } from "./pages/ChapterPage";
import { ThemeProvider } from "./theme/ThemeProvider";

export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ChapterPage slug="introduction" />} />
          <Route path="/:slug/:stage?" element={<ChapterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
