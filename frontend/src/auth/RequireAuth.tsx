// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import type { ReactNode } from "react";
import { Navigate, type Path, useLocation } from "react-router";
import { useAppSelector } from "../store/store";

interface Props {
  children: ReactNode;
}

// Unauthenticated visits go to the sign-in screen carrying the attempted
// location; LoginPage reads it back with readReturnTo after signing in.
export function RequireAuth({ children }: Props) {
  const access = useAppSelector((state) => state.auth.access);
  const location = useLocation();
  if (access === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

// The location RequireAuth stored in history state, or null. State is
// unknown: it survives reloads and can be anything.
export function readReturnTo(state: unknown): Path | null {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return null;
  }
  const { from } = state;
  if (
    typeof from !== "object" ||
    from === null ||
    !("pathname" in from) ||
    typeof from.pathname !== "string"
  ) {
    return null;
  }
  return {
    pathname: from.pathname,
    search:
      "search" in from && typeof from.search === "string" ? from.search : "",
    hash: "hash" in from && typeof from.hash === "string" ? from.hash : "",
  };
}
