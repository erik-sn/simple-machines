import { useTranslation } from "react-i18next";
import { PageTitle } from "./PageTitle";

interface Props {
  onRetry: () => void;
}

// What the user sees when a screen throws while rendering.
export function ErrorFallback({ onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <PageTitle screen={t("crash.title")} />
      <h1 tabIndex={-1} className="text-2xl font-semibold text-slate-900">
        {t("crash.title")}
      </h1>
      <p role="alert" className="text-slate-700">
        {t("crash.body")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800"
      >
        {t("crash.retry")}
      </button>
    </main>
  );
}
