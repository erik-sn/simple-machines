// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Feature flags, served by the backend (django-waffle, managed in the admin)
// through the typed /api/v1/flags/ endpoint. Unknown or unloaded flags are
// off - a missing flag must never open a feature.
import { useFlagsQuery } from "../store/generatedApi";

export function useFlag(name: string): boolean {
  const { data } = useFlagsQuery();
  return data?.flags[name] ?? false;
}
