import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { type InitialEntry, Route, Routes } from "react-router";
import { expect, test } from "vitest";
import { loadTokens } from "../auth/tokens";
import { tokens } from "../test/handlers";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";
import { LoginPage } from "./LoginPage";

function renderLogin(route: InitialEntry = "/login") {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Home screen</p>} />
      <Route path="/notes" element={<p>Notes screen</p>} />
    </Routes>,
    { route },
  );
}

async function submitCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "e2e");
  await user.type(screen.getByLabelText("Password"), "e2e-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

test("signs in and returns to the screen the visitor was heading for", async () => {
  const { store } = renderLogin({
    pathname: "/login",
    state: { from: { pathname: "/notes", search: "?page=2", hash: "" } },
  });

  await submitCredentials();

  expect(await screen.findByText("Notes screen")).toBeInTheDocument();
  expect(store.getState().auth).toEqual(tokens);
  expect(loadTokens()).toEqual(tokens);
});

test("lands on the home screen when nothing was attempted", async () => {
  renderLogin();
  await submitCredentials();
  expect(await screen.findByText("Home screen")).toBeInTheDocument();
});

test("maps a field error onto its input and focuses it", async () => {
  server.use(
    http.post("/api/v1/auth/token/", () =>
      HttpResponse.json(
        {
          type: "validation_error",
          errors: [
            {
              code: "blank",
              detail: "This field may not be blank.",
              attr: "password",
            },
          ],
        },
        { status: 400 },
      ),
    ),
  );
  renderLogin();

  await submitCredentials();

  const password = screen.getByLabelText("Password");
  await waitFor(() => expect(password).toBeInvalid());
  expect(password).toHaveAccessibleDescription("This field may not be blank.");
  expect(password).toHaveFocus();
  expect(screen.getByLabelText("Username")).not.toBeInvalid();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Check the highlighted fields.",
  );
});

test("shows the API's message when sign-in is rejected", async () => {
  server.use(
    http.post("/api/v1/auth/token/", () =>
      HttpResponse.json(
        {
          type: "client_error",
          errors: [
            {
              code: "no_active_account",
              detail: "No active account found with the given credentials",
              attr: null,
            },
          ],
        },
        { status: 401 },
      ),
    ),
  );
  renderLogin();

  await submitCredentials();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No active account found with the given credentials",
  );
  expect(loadTokens()).toBeNull();
});

test("disables the submit button while the request is pending", async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post("/api/v1/auth/token/", async () => {
      await gate;
      return HttpResponse.json(tokens);
    }),
  );
  renderLogin();
  const submit = screen.getByRole("button", { name: "Sign in" });

  await submitCredentials();

  await waitFor(() => expect(submit).toBeDisabled());
  release();
  expect(await screen.findByText("Home screen")).toBeInTheDocument();
});
