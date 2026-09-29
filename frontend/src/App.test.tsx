import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "./App";
import { renderWithProviders } from "./test/renderWithProviders";

// App carries its own Provider (the app singleton store), so these tests
// prove the shell: routing, lazy screens, the sign-in redirect.

test("unauthenticated visitors are routed to the sign-in screen", async () => {
  renderWithProviders(<App />, { route: "/" });
  expect(
    await screen.findByRole("heading", { name: "Sign in" }),
  ).toBeInTheDocument();
});

test("the app mounts as a plain component (importable from other repos)", async () => {
  renderWithProviders(<App />, { route: "/login" });
  expect(await screen.findByLabelText("Username")).toBeInTheDocument();
});
