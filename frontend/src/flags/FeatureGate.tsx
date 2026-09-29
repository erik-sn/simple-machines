// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Hides a feature's surface (a route, a menu entry, a panel) while its flag is
// off: the frontend half of the backend's FeatureFlagGate (404). Nothing
// renders until the flags have loaded, so a default-on feature never flashes
// its fallback; a flags outage is thrown to the error boundary rather than
// silently hiding every gated feature.
import type { ReactNode } from "react";
import { useFlagsQuery } from "../store/generatedApi";

interface Props {
  flag: string;
  // Rendered while the flag is off; nothing by default.
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ flag, fallback = null, children }: Props) {
  const { data, isError } = useFlagsQuery();
  if (isError) {
    throw new Error("Feature flags could not be loaded");
  }
  if (data === undefined) {
    return null;
  }
  return data.flags[flag] ? children : fallback;
}
