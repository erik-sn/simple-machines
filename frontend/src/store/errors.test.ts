// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { expect, test } from "vitest";
import i18n from "../i18n";
import {
  errorMessage,
  isApiError,
  isFetchBaseQueryError,
  parseApiError,
} from "./errors";

const { t } = i18n;

function apiError(status: number, type: string, errors: unknown[]) {
  return { status, data: { type, errors } };
}

test("parseApiError splits field and non-field errors", () => {
  const error = apiError(400, "validation_error", [
    { code: "blank", detail: "This field may not be blank.", attr: "title" },
    { code: "invalid", detail: "Too long.", attr: "title" },
    { code: "required", detail: "Pick a city.", attr: "address.city" },
    {
      code: "invalid",
      detail: "Title and body clash.",
      attr: "non_field_errors",
    },
    { code: "invalid", detail: "Nothing to save.", attr: null },
  ]);
  expect(parseApiError(error)).toEqual({
    type: "validation_error",
    fieldErrors: {
      title: ["This field may not be blank.", "Too long."],
      "address.city": ["Pick a city."],
    },
    nonFieldErrors: ["Title and body clash.", "Nothing to save."],
  });
});

test("anything that is not the API's error shape parses as unknown", () => {
  expect(
    parseApiError({ status: 500, data: "<html>Bad gateway</html>" }),
  ).toEqual({
    type: null,
    fieldErrors: {},
    nonFieldErrors: [],
  });
  expect(
    parseApiError({ status: "FETCH_ERROR", error: "TypeError" }).type,
  ).toBeNull();
  expect(
    parseApiError({ status: 400, data: { detail: "legacy" } }).type,
  ).toBeNull();
  expect(parseApiError(new Error("thrown")).type).toBeNull();
  expect(parseApiError(undefined).type).toBeNull();
});

test("the guards accept only their shapes", () => {
  expect(isFetchBaseQueryError({ status: 404, data: {} })).toBe(true);
  expect(isFetchBaseQueryError({ name: "Error", message: "x" })).toBe(false);
  expect(isApiError({ type: "client_error", errors: [] })).toBe(true);
  expect(isApiError({ type: "other", errors: [] })).toBe(false);
  expect(isApiError({ type: "client_error" })).toBe(false);
  expect(
    isApiError({
      type: "client_error",
      errors: [{ code: "x", detail: 1, attr: null }],
    }),
  ).toBe(false);
});

test("errorMessage prefers the API's words, then a generic message", () => {
  expect(
    errorMessage(
      apiError(401, "client_error", [
        {
          code: "no_active_account",
          detail: "No active account found.",
          attr: null,
        },
      ]),
      t,
    ),
  ).toBe("No active account found.");
  expect(
    errorMessage(
      apiError(400, "validation_error", [
        { code: "invalid", detail: "Dates overlap.", attr: "non_field_errors" },
        { code: "blank", detail: "Required.", attr: "title" },
      ]),
      t,
    ),
  ).toBe("Dates overlap.");
  expect(
    errorMessage(
      apiError(400, "validation_error", [
        { code: "blank", detail: "Required.", attr: "title" },
      ]),
      t,
    ),
  ).toBe("Check the highlighted fields.");
  expect(
    errorMessage(
      apiError(500, "server_error", [
        { code: "error", detail: "Internal server error.", attr: null },
      ]),
      t,
    ),
  ).toBe("Something went wrong. Try again.");
  expect(errorMessage({ status: "TIMEOUT_ERROR", error: "x" }, t)).toBe(
    "Something went wrong. Try again.",
  );
});
