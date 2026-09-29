import { type FormEvent, useId } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { readReturnTo } from "../auth/RequireAuth";
import { saveTokens } from "../auth/tokens";
import { FieldError } from "../components/FieldError";
import { PageTitle } from "../components/PageTitle";
import { useAuthTokenCreateMutation } from "../store/api";
import { setCredentials } from "../store/authSlice";
import { errorMessage, parseApiError } from "../store/errors";
import { useAppDispatch } from "../store/store";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [obtainToken, { isLoading, error }] = useAuthTokenCreateMutation();
  const id = useId();
  // The mutation is the form's only pending and error source.
  const { fieldErrors } = parseApiError(error);
  const summary = error === undefined ? null : errorMessage(error, t);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Uncontrolled inputs: the browser owns the values until submit.
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const tokens = await obtainToken({
        tokenObtainPairRequest: {
          username: field(values, "username"),
          password: field(values, "password"),
        },
      }).unwrap();
      dispatch(setCredentials(tokens));
      saveTokens(tokens);
      navigate(readReturnTo(location.state) ?? "/", { replace: true });
    } catch (failure) {
      // `error` from the hook renders the messages; focus the first field the
      // API rejected so the correction starts there.
      const [invalid] = Object.keys(parseApiError(failure).fieldErrors);
      const control =
        invalid === undefined ? null : form.elements.namedItem(invalid);
      if (control instanceof HTMLElement) {
        control.focus();
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <PageTitle screen={t("login.title")} />
      <form
        onSubmit={handleSubmit}
        aria-describedby={summary === null ? undefined : `${id}-summary`}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 tabIndex={-1} className="text-xl font-semibold text-slate-900">
          {t("login.title")}
        </h1>
        <label className="block space-y-1">
          <span className="text-sm text-slate-700">{t("login.username")}</span>
          <input
            name="username"
            autoComplete="username"
            required
            aria-invalid={fieldErrors.username === undefined ? undefined : true}
            aria-describedby={
              fieldErrors.username === undefined ? undefined : `${id}-username`
            }
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <FieldError id={`${id}-username`} messages={fieldErrors.username} />
        <label className="block space-y-1">
          <span className="text-sm text-slate-700">{t("login.password")}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={fieldErrors.password === undefined ? undefined : true}
            aria-describedby={
              fieldErrors.password === undefined ? undefined : `${id}-password`
            }
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <FieldError id={`${id}-password`} messages={fieldErrors.password} />
        {summary !== null && (
          <p id={`${id}-summary`} role="alert" className="text-sm text-red-700">
            {summary}
          </p>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {t("login.submit")}
        </button>
      </form>
    </main>
  );
}
