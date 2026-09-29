import { Link } from "react-router";

interface Props {
  previous: string | null;
  next: string | null;
}

// Page-turn affordances at the page edges; the keyboard arrows do the same.
export function NavArrows({ previous, next }: Props) {
  return (
    <>
      {previous !== null && (
        <Link
          to={previous}
          viewTransition
          aria-label="Previous page"
          className="text-ink-faint hover:text-ink absolute top-1/2 left-4 -translate-y-1/2 p-3 font-display text-3xl"
        >
          ‹
        </Link>
      )}
      {next !== null && (
        <Link
          to={next}
          viewTransition
          aria-label="Next page"
          className="text-ink-faint hover:text-ink absolute top-1/2 right-4 -translate-y-1/2 p-3 font-display text-3xl"
        >
          ›
        </Link>
      )}
    </>
  );
}
