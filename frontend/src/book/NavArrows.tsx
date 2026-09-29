import { Link } from "react-router";

interface Props {
  previous: string | null;
}

// The way back sits at the foot of the page, opposite the catchword; the
// keyboard arrows do the same.
export function NavArrows({ previous }: Props) {
  if (previous === null) {
    return null;
  }
  return (
    <Link
      to={previous}
      viewTransition
      aria-label="Previous page"
      className="nav-arrow text-ink-faint hover:text-ink absolute font-display text-2xl leading-none"
    >
      ‹
    </Link>
  );
}
