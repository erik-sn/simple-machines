// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { HttpResponse, http, type JsonBodyType } from "msw";
import { expect, test } from "vitest";
import { loadTokens, saveTokens } from "../auth/tokens";
import { server } from "../test/server";
import { generatedApi } from "./generatedApi";
import { setupStore } from "./store";

const expired = { access: "expired", refresh: "refresh-1" };
const unauthorized = {
  type: "client_error",
  errors: [
    {
      code: "token_not_valid",
      detail: "Given token not valid for any token type",
      attr: null,
    },
  ],
};
const healthy = { status: "ok" };

// 401 unless the request carries the refreshed token. The endpoints are
// core's own (health, flags), so the test holds whatever the project adds.
function requiringFreshToken(body: JsonBodyType) {
  return ({ request }: { request: Request }) =>
    request.headers.get("Authorization") === "Bearer fresh"
      ? HttpResponse.json(body)
      : HttpResponse.json(unauthorized, { status: 401 });
}

test("concurrent 401s share one refresh and every request is retried", async () => {
  let refreshCalls = 0;
  server.use(
    http.get("/api/v1/health/", requiringFreshToken(healthy)),
    http.get("/api/v1/flags/", requiringFreshToken({ flags: {} })),
    http.post("/api/v1/auth/token/refresh/", () => {
      refreshCalls += 1;
      return HttpResponse.json({ access: "fresh", refresh: "refresh-2" });
    }),
  );
  saveTokens(expired);
  const store = setupStore({ auth: expired });

  const [health, flags] = await Promise.all([
    store.dispatch(generatedApi.endpoints.health.initiate()),
    store.dispatch(generatedApi.endpoints.flags.initiate()),
  ]);

  expect(refreshCalls).toBe(1);
  expect(health.data).toEqual(healthy);
  expect(flags.data).toEqual({ flags: {} });
  const fresh = { access: "fresh", refresh: "refresh-2" };
  expect(store.getState().auth).toEqual(fresh);
  expect(loadTokens()).toEqual(fresh);
});

test("a failed refresh ends the session: credentials, tokens, and cache", async () => {
  server.use(
    http.get("/api/v1/health/", requiringFreshToken(healthy)),
    http.post("/api/v1/auth/token/refresh/", () =>
      HttpResponse.json(unauthorized, { status: 401 }),
    ),
  );
  saveTokens(expired);
  const store = setupStore({ auth: expired });

  const result = await store.dispatch(generatedApi.endpoints.health.initiate());

  // The reset removed the cache entry the request belonged to.
  expect(result.isSuccess).toBe(false);
  expect(store.getState().auth).toEqual({ access: null, refresh: null });
  expect(loadTokens()).toBeNull();
  expect(store.getState().api.queries).toEqual({});
});

test("a 401 without a refresh token is returned as is", async () => {
  let refreshCalls = 0;
  server.use(
    http.get("/api/v1/health/", () =>
      HttpResponse.json(unauthorized, { status: 401 }),
    ),
    http.post("/api/v1/auth/token/refresh/", () => {
      refreshCalls += 1;
      return HttpResponse.json({ access: "fresh", refresh: "refresh-2" });
    }),
  );
  const store = setupStore({ auth: { access: null, refresh: null } });

  const result = await store.dispatch(generatedApi.endpoints.health.initiate());

  expect(refreshCalls).toBe(0);
  expect(result.error).toMatchObject({ status: 401, data: unauthorized });
});
