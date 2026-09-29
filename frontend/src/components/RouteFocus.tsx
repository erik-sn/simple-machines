// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

// After a client-side navigation, move focus to the new screen's heading so
// assistive technology announces the page and keyboard focus is not left on a
// control that no longer exists. Screens render <h1 tabIndex={-1}>. The
// initial load is skipped: the browser already starts at the top.
// Render it inside the Suspense boundary, beside <Outlet />, so the effect
// commits together with the screen it targets rather than with the fallback.
export function RouteFocus() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) {
      return;
    }
    previous.current = pathname;
    document.querySelector<HTMLElement>("h1[tabindex='-1']")?.focus();
  }, [pathname]);
  return null;
}
