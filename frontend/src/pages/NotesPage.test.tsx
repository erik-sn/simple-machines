import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, HttpResponse, http } from "msw";
import { expect, test } from "vitest";
import { loadTokens, saveTokens } from "../auth/tokens";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";
import { NotesPage } from "./NotesPage";

const signedIn = {
  auth: { access: "access-token", refresh: "refresh-token" },
};

function renderNotes(route = "/") {
  return renderWithProviders(<NotesPage />, {
    preloadedState: signedIn,
    route,
  });
}

test("shows a loading state until the list arrives", async () => {
  server.use(
    http.get("/api/v1/notes/", async () => {
      await delay("infinite");
    }),
  );
  renderNotes();
  expect(await screen.findByRole("status")).toHaveTextContent("Loading...");
});

test("shows an alert when the list cannot be loaded", async () => {
  server.use(
    http.get("/api/v1/notes/", () =>
      HttpResponse.json(
        {
          type: "server_error",
          errors: [
            { code: "error", detail: "Internal server error.", attr: null },
          ],
        },
        { status: 500 },
      ),
    ),
  );
  renderNotes();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Something went wrong. Try again.",
  );
});

test("shows the empty state", async () => {
  server.use(
    http.get("/api/v1/notes/", () =>
      HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
    ),
  );
  renderNotes();
  expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
});

test("renders each note with its time and word count", async () => {
  renderNotes();
  expect(
    await screen.findByRole("heading", { name: "First note" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Second note" }),
  ).toBeInTheDocument();
  expect(screen.getByText("4 words")).toBeInTheDocument();
  const [firstTime] = screen.getAllByRole("time");
  expect(firstTime).toHaveAttribute("dateTime", "2026-09-01T10:00:00Z");
  expect(firstTime).toHaveTextContent(/Sep 1, 2026/);
  // The screen's <title> is hoisted into <head> ahead of the static one.
  expect(document.title).toMatch(/^Notes - /);
});

test("pages through the list with the page kept in the URL", async () => {
  const user = userEvent.setup();
  renderNotes();
  await screen.findByRole("heading", { name: "First note" });
  const previous = screen.getByRole("button", { name: "Previous" });
  const next = screen.getByRole("button", { name: "Next" });
  expect(previous).toBeDisabled();
  expect(next).toBeEnabled();

  await user.click(next);

  expect(
    await screen.findByRole("heading", { name: "Third note" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Page 2")).toBeInTheDocument();
  expect(previous).toBeEnabled();
  expect(next).toBeDisabled();
});

test("opens on the page named in the URL", async () => {
  renderNotes("/?page=2");
  expect(
    await screen.findByRole("heading", { name: "Third note" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "First note" }),
  ).not.toBeInTheDocument();
});

test("signing out clears the session", async () => {
  const user = userEvent.setup();
  saveTokens(signedIn.auth);
  const { store } = renderNotes();
  await screen.findByRole("heading", { name: "First note" });

  await user.click(screen.getByRole("button", { name: "Sign out" }));

  expect(store.getState().auth).toEqual({ access: null, refresh: null });
  expect(loadTokens()).toBeNull();
});
