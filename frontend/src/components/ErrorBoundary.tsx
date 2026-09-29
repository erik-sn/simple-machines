// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  // Rendered in place of the crashed subtree; `reset` renders it again.
  fallback: (reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
}

// The only class component: React has no hook for catching render errors.
// Rendering, not reporting, is its job; error tracking hooks into
// componentDidCatch when it is wired.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(): void {
    // React has already logged the error in development.
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback(() => this.setState({ hasError: false }));
    }
    return this.props.children;
  }
}
