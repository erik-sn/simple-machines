// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Runs before every test file (vite.config.ts, test.setupFiles).
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// fetchBaseQuery builds `new Request("/api/...")`. A browser resolves that
// against the document; Node's Request, which jsdom does not replace, throws
// before fetch runs, so MSW would never see the call. Resolve relative URLs
// against the document here, as the browser does.
const NodeRequest = globalThis.Request;
globalThis.Request = class Request extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(
      typeof input === "string" && !URL.canParse(input)
        ? new URL(input, document.baseURI)
        : input,
      init,
    );
  }
};

// Every request must match a handler: an unexpected call fails the test
// instead of silently hitting nothing.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
