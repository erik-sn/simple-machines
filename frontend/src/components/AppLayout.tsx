import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";
import { RouteFocus } from "./RouteFocus";

// The pathless layout route: one error boundary for render errors, one
// Suspense boundary for the lazy screens, focus management on navigation.
export function AppLayout() {
  const { t } = useTranslation();
  return (
    <ErrorBoundary fallback={(reset) => <ErrorFallback onRetry={reset} />}>
      <Suspense
        fallback={
          <p role="status" className="p-8 text-slate-600">
            {t("common.loading")}
          </p>
        }
      >
        <RouteFocus />
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}
