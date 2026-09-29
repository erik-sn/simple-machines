// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// RTK Query client generation from the committed OpenAPI schema:
//   just api-client
// Never edit src/store/generatedApi.ts by hand; change the DRF code, then
// regenerate schema and client (both drift-gated in CI). Plain JS because the
// codegen CLI would need an extra TS runner dependency for a .ts config.

/** @type {import("@rtk-query/codegen-openapi").ConfigFile} */
const config = {
  schemaFile: "../backend/schema.yaml",
  apiFile: "./src/store/baseApi.ts",
  apiImport: "baseApi",
  outputFile: "./src/store/generatedApi.ts",
  exportName: "generatedApi",
  hooks: true,
  // One cache tag per OpenAPI tag (the API resource): a mutation under
  // /notes/ refetches every notes query with no hand-written invalidation.
  tag: true,
  // Untyped schema parts become `unknown` instead of `any`, so every value
  // that enters from outside the type system is narrowed before use.
  useUnknown: true,
};

export default config;
