// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { expect, test, vi } from "vitest";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";
import { FeatureGate } from "./FeatureGate";

function flagsAre(flags: Record<string, boolean>) {
  server.use(http.get("/api/v1/flags/", () => HttpResponse.json({ flags })));
}

function renderGated() {
  return renderWithProviders(
    <FeatureGate flag="demo" fallback={<p>Feature is off</p>}>
      <p>Feature is on</p>
    </FeatureGate>,
  );
}

test("renders nothing until the flags arrive, then the feature when its flag is on", async () => {
  flagsAre({ demo: true });
  const { container } = renderGated();
  expect(container).toBeEmptyDOMElement();
  expect(await screen.findByText("Feature is on")).toBeInTheDocument();
  expect(screen.queryByText("Feature is off")).not.toBeInTheDocument();
});

test("renders the fallback while the flag is off or unknown", async () => {
  flagsAre({});
  renderGated();
  expect(await screen.findByText("Feature is off")).toBeInTheDocument();
  expect(screen.queryByText("Feature is on")).not.toBeInTheDocument();
});

test("a flags outage reaches the error boundary instead of hiding the feature", async () => {
  server.use(
    http.get("/api/v1/flags/", () => HttpResponse.json({}, { status: 500 })),
  );
  // React reports the caught render error on the console; the boundary is the assertion.
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  renderWithProviders(
    <ErrorBoundary fallback={() => <p>Something broke</p>}>
      <FeatureGate flag="demo">
        <p>Feature is on</p>
      </FeatureGate>
    </ErrorBoundary>,
  );
  expect(await screen.findByText("Something broke")).toBeInTheDocument();
  consoleError.mockRestore();
});
