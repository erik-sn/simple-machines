import { PageTitle } from "./PageTitle";

interface Props {
  onRetry: () => void;
}

// What the user sees when a screen throws while rendering.
export function ErrorFallback({ onRetry }: Props) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <PageTitle screen="Something went wrong" />
      <h1 tabIndex={-1} className="text-2xl font-semibold">
        Something went wrong
      </h1>
      <p role="alert">The page could not be drawn. Try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border px-3 py-2 font-medium"
      >
        Try again
      </button>
    </main>
  );
}
