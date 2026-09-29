// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { screen } from "@testing-library/react";
import { createPath, Route, Routes, useLocation } from "react-router";
import { expect, test } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { RequireAuth, readReturnTo } from "./RequireAuth";

// Stands in for LoginPage: shows where RequireAuth asked to return to.
function ReturnToProbe() {
  const { state } = useLocation();
  const returnTo = readReturnTo(state);
  return (
    <p>{returnTo === null ? "no return location" : createPath(returnTo)}</p>
  );
}

function renderGuarded(route: string, preloadedState = {}) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<ReturnToProbe />} />
      <Route
        path="/notes"
        element={
          <RequireAuth>
            <p>Protected content</p>
          </RequireAuth>
        }
      />
    </Routes>,
    { route, preloadedState },
  );
}

test("renders the protected screen for a signed-in user", () => {
  renderGuarded("/notes", { auth: { access: "access", refresh: "refresh" } });
  expect(screen.getByText("Protected content")).toBeInTheDocument();
});

test("redirects a visitor to sign in, remembering where they were going", async () => {
  renderGuarded("/notes?page=2");
  expect(await screen.findByText("/notes?page=2")).toBeInTheDocument();
  expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
});

test("readReturnTo ignores state that is not a stored location", () => {
  expect(readReturnTo(null)).toBeNull();
  expect(readReturnTo({ from: "/notes" })).toBeNull();
  expect(readReturnTo({ from: { search: "?x" } })).toBeNull();
  expect(readReturnTo({ from: { pathname: "/notes" } })).toEqual({
    pathname: "/notes",
    search: "",
    hash: "",
  });
});
