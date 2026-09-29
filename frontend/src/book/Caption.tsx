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
    <div className="caption pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-10">
      <div className="pointer-events-auto w-full max-w-prose text-center">
        <h1
          tabIndex={-1}
          className={
            isTitlePage
              ? "font-display text-ink text-4xl tracking-wide"
              : "font-display text-ink-soft text-sm uppercase tracking-widest"
          }
        >
          {chapter.numeral !== null && (
            <span className="text-ink-soft">Chapter {chapter.numeral} · </span>
          )}
          {chapter.title}
        </h1>
        {stage.title !== undefined && (
          <h2 className="font-display text-ink mt-3 text-2xl">{stage.title}</h2>
        )}
        {stage.text.map((paragraph) => (
          <p
            key={paragraph}
            className="font-body text-ink mt-3 text-lg leading-relaxed"
          >
            {paragraph}
          </p>
        ))}
        {chapter.stages.length > 1 && (
          <p className="text-ink-soft mt-4 text-xs tracking-widest">
            {stageIndex + 1} / {chapter.stages.length}
          </p>
        )}
      </div>
    </div>
  );
}
