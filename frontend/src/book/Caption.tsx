import { Link } from "react-router";
import type { Chapter, Stage } from "./chapters";

interface Props {
  chapter: Chapter;
  stage: Stage;
  stageIndex: number;
  // The next page and the first word of its text: the catchword, which is
  // the period's way of saying "there is a next page", and the link to it.
  nextPath: string | null;
  catchword: string | null;
}

// The placard: the only text on the page, at the foot; on the title page, at
// the head with the plate as the device below. The chapter title is the
// page's h1 (RouteFocus moves focus to it after navigation).
export function Caption({
  chapter,
  stage,
  stageIndex,
  nextPath,
  catchword,
}: Props) {
  const isTitlePage = chapter.kind === "introduction" && stageIndex === 0;
  return (
    <>
      <div
        className="caption pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6"
        data-title={isTitlePage ? "" : undefined}
      >
        <div className="caption-block pointer-events-auto w-full text-center">
          <h1
            tabIndex={-1}
            className={
              isTitlePage
                ? "font-title text-ink text-step-3 uppercase leading-none tracking-wide"
                : "font-display text-ink-soft text-step--1 lowercase tracking-widest"
            }
          >
            {chapter.numeral !== null && (
              <span className="text-ink-soft">
                Chapter <span className="normal-case">{chapter.numeral}</span> ·{" "}
              </span>
            )}
            {chapter.title}
          </h1>
          {stage.title !== undefined && (
            <h2 className="font-body text-ink text-step-1 mt-3 italic">
              {stage.title}
            </h2>
          )}
          {stage.text.map((paragraph) => (
            <p
              key={paragraph}
              className={
                isTitlePage
                  ? "font-body text-ink text-step-1 mt-4 italic"
                  : "font-body text-ink text-step-0 mt-3 text-pretty"
              }
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
      <p className="folio font-body text-ink-faint text-step--1 absolute">
        {nextPath !== null && catchword !== null && (
          <Link
            to={nextPath}
            viewTransition
            aria-label="Next page"
            className="catchword hover:text-ink mr-6 italic"
          >
            {catchword}
          </Link>
        )}
        {!isTitlePage && (
          <span>
            <span className="sr-only">Page </span>
            {stageIndex + 1}
            <span className="sr-only"> of {chapter.stages.length}</span>
          </span>
        )}
      </p>
    </>
  );
}
