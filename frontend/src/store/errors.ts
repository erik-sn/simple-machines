// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Narrowing for RTK Query errors. The API answers every failure with one
// shape (the backend's exception handler):
//   { type: "validation_error" | "client_error" | "server_error",
//     errors: [{ code, detail, attr }] }
// where attr is a dotted field path, "non_field_errors", or null.
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { TFunction } from "i18next";

export type ApiErrorType = "validation_error" | "client_error" | "server_error";

export interface ApiErrorItem {
  code: string;
  detail: string;
  attr: string | null;
}

export interface ApiError {
  type: ApiErrorType;
  errors: ApiErrorItem[];
}

export interface ParsedApiError {
  // null when the failure never reached the API (network, timeout, parsing)
  // or the body is not the API's error shape.
  type: ApiErrorType | null;
  fieldErrors: Record<string, string[]>;
  nonFieldErrors: string[];
}

const API_ERROR_TYPES: ReadonlySet<string> = new Set<ApiErrorType>([
  "validation_error",
  "client_error",
  "server_error",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isFetchBaseQueryError(
  error: unknown,
): error is FetchBaseQueryError {
  return isRecord(error) && "status" in error;
}

function isApiErrorItem(value: unknown): value is ApiErrorItem {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.detail === "string" &&
    (value.attr === null || typeof value.attr === "string")
  );
}

export function isApiError(data: unknown): data is ApiError {
  return (
    isRecord(data) &&
    typeof data.type === "string" &&
    API_ERROR_TYPES.has(data.type) &&
    Array.isArray(data.errors) &&
    data.errors.every(isApiErrorItem)
  );
}

export function parseApiError(error: unknown): ParsedApiError {
  const parsed: ParsedApiError = {
    type: null,
    fieldErrors: {},
    nonFieldErrors: [],
  };
  if (!isFetchBaseQueryError(error) || !isApiError(error.data)) {
    return parsed;
  }
  parsed.type = error.data.type;
  for (const { attr, detail } of error.data.errors) {
    if (attr === null || attr === "non_field_errors") {
      parsed.nonFieldErrors.push(detail);
      continue;
    }
    const existing = parsed.fieldErrors[attr];
    if (existing === undefined) {
      parsed.fieldErrors[attr] = [detail];
    } else {
      existing.push(detail);
    }
  }
  return parsed;
}

// The one-line summary for a role="alert": the API's own words for client and
// validation failures, a generic message for everything else (server errors,
// network failures, timeouts, malformed responses).
export function errorMessage(error: unknown, t: TFunction): string {
  const { type, fieldErrors, nonFieldErrors } = parseApiError(error);
  const [first] = nonFieldErrors;
  switch (type) {
    case "validation_error":
      if (first !== undefined) {
        return first;
      }
      return Object.keys(fieldErrors).length > 0
        ? t("common.invalidFields")
        : t("common.error");
    case "client_error":
      return first ?? t("common.error");
    case "server_error":
    case null:
      return t("common.error");
  }
}
