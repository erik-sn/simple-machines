import { PageTitle } from "../components/PageTitle";

// Placeholder title page; the book shell replaces it.
export function CoverPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <PageTitle />
      <h1 tabIndex={-1} className="text-3xl font-semibold">
        Simple Machines
      </h1>
    </main>
  );
}
