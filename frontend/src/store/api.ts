// The project's API surface: the generated endpoints, refined here. Per-id
// tags, related-resource invalidation, and optimistic updates (onQueryStarted
// with patchResult.undo()) go into enhanceEndpoints below, never into the
// generated file, which `just api-client` overwrites.
import { generatedApi } from "./generatedApi";

export const api = generatedApi.enhanceEndpoints({ endpoints: {} });

// Screens import their hooks from here: one line per endpoint in use.
export const { useAuthTokenCreateMutation, useNotesListQuery, usePrefetch } =
  api;
