// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Outlet, Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { RouteFocus } from "./RouteFocus";

function Screen({ name }: { name: string }) {
  return (
    <main>
      <h1 tabIndex={-1}>{name}</h1>
      <Link to="/second">Go to second</Link>
    </main>
  );
}

function Shell() {
  return (
    <>
      <RouteFocus />
      <Outlet />
    </>
  );
}

test("moves focus to the new screen's heading after navigation, not on load", async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Screen name="First" />} />
        <Route path="/second" element={<Screen name="Second" />} />
      </Route>
    </Routes>,
  );
  expect(screen.getByRole("heading", { name: "First" })).not.toHaveFocus();

  await user.click(screen.getByRole("link", { name: "Go to second" }));

  expect(await screen.findByRole("heading", { name: "Second" })).toHaveFocus();
});
