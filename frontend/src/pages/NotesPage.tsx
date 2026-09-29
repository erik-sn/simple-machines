import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { logout } from "../auth/logout";
import { PageTitle } from "../components/PageTitle";
import { useFlag } from "../flags/useFlag";
import { formatDateTime } from "../i18n/format";
import { useNotesListQuery, usePrefetch } from "../store/api";
import { useAppDispatch } from "../store/store";

export function NotesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // The page is URL state: bookmarkable, and passed straight into the query.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const { data, isLoading, isError, isFetching } = useNotesListQuery({ page });
  const prefetchNotes = usePrefetch("notesList");
  // Feature-flag demo: toggled from the admin (Flags > example-banner).
  const showBanner = useFlag("example-banner");
  const hasPrevious = data?.previous != null;
  const hasNext = data?.next != null;

  function goToPage(target: number) {
    setSearchParams({ page: String(target) });
  }

  function prefetchNext() {
    if (hasNext) {
      prefetchNotes({ page: page + 1 });
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <PageTitle screen={t("notes.title")} />
      <header className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-slate-900">
          {t("notes.title")}
        </h1>
        <button
          type="button"
          onClick={() => dispatch(logout())}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
        >
          {t("notes.logout")}
        </button>
      </header>
      {showBanner && (
        <p className="rounded bg-amber-100 px-4 py-2 text-amber-900">
          {t("notes.banner")}
        </p>
      )}
      {isLoading && (
        <p role="status" className="text-slate-600">
          {t("common.loading")}
        </p>
      )}
      {isError && (
        <p role="alert" className="text-red-700">
          {t("common.error")}
        </p>
      )}
      {data !== undefined && (
        <>
          {data.results.length === 0 ? (
            <p className="text-slate-600">{t("notes.empty")}</p>
          ) : (
            <ul aria-busy={isFetching} className="space-y-3">
              {data.results.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <h2 className="font-medium text-slate-900">{note.title}</h2>
                    {/* API time is UTC ISO-8601; display converts to local. */}
                    <time
                      dateTime={note.created_at}
                      className="text-xs text-slate-600"
                    >
                      {formatDateTime(note.created_at)}
                    </time>
                  </div>
                  {note.word_count !== null && (
                    <p className="mt-2 text-xs text-slate-600">
                      {t("notes.words", { count: note.word_count })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* The previous page stays on screen while the next one loads. */}
          <nav
            aria-label={t("notes.pagination")}
            className={`flex items-center justify-between ${isFetching ? "opacity-50" : ""}`}
          >
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() => goToPage(page - 1)}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {t("notes.previous")}
            </button>
            <span className="text-sm text-slate-600">
              {t("notes.page", { page })}
            </span>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => goToPage(page + 1)}
              onMouseEnter={prefetchNext}
              onFocus={prefetchNext}
              className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {t("notes.next")}
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
