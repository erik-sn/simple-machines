import { Suspense } from "react";
import { Outlet } from "react-router";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";
import { RouteFocus } from "./RouteFocus";

// The pathless layout route: one error boundary for render errors, one
// Suspense boundary for the lazy screens, focus management on navigation.
export function AppLayout() {
  return (
    <ErrorBoundary fallback={(reset) => <ErrorFallback onRetry={reset} />}>
      <Suspense fallback={<p role="status">Loading</p>}>
        <RouteFocus />
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}
