import type { Chapter, Stage } from "./chapters";

interface Props {
  chapter: Chapter;
  stage: Stage;
  stageIndex: number;
}

// The placard: the only text on the page, at the bottom. The chapter title is
// the page's h1 (RouteFocus moves focus to it after navigation).
export function Caption({ chapter, stage, stageIndex }: Props) {
  const isTitlePage = chapter.kind === "introduction" && stageIndex === 0;
  return (
    <div className="caption pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6">
      <div className="caption-block pointer-events-auto w-full text-center">
        <h1
          tabIndex={-1}
          className={
            isTitlePage
              ? "font-title text-ink text-step-3 leading-none tracking-wide"
              : "font-display text-ink-soft text-step--1 lowercase tracking-widest"
          }
        >
          {chapter.numeral !== null && (
            <span className="text-ink-soft">Chapter {chapter.numeral} · </span>
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
            className="font-body text-ink text-step-0 mt-3 leading-snug text-pretty"
          >
            {paragraph}
          </p>
        ))}
        {chapter.stages.length > 1 && (
          <p className="font-display text-ink-soft text-step--1 mt-4 tracking-widest">
            {stageIndex + 1} / {chapter.stages.length}
          </p>
        )}
      </div>
    </div>
  );
}
