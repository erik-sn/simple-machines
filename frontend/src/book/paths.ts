import { CHAPTERS, type Chapter } from "./chapters";

export interface BookPosition {
  chapterIndex: number;
  stageIndex: number;
}

// The URL for a stage. The title page is "/", a chapter's first stage is
// "/<slug>", later stages "/<slug>/<n>" with n counted from 1, the Theatre
// "/theatre".
export function stagePath(chapter: Chapter, stageIndex: number): string {
  if (chapter.kind === "introduction" && stageIndex === 0) {
    return "/";
  }
  if (stageIndex === 0) {
    return `/${chapter.slug}`;
  }
  return `/${chapter.slug}/${stageIndex + 1}`;
}

export function positionPath(position: BookPosition): string {
  const chapter = CHAPTERS[position.chapterIndex];
  if (chapter === undefined) {
    throw new Error(`No chapter at index ${position.chapterIndex}`);
  }
  return stagePath(chapter, position.stageIndex);
}

export function findChapterIndex(slug: string): number {
  return CHAPTERS.findIndex((c) => c.slug === slug);
}

export function nextPosition(position: BookPosition): BookPosition | null {
  const chapter = CHAPTERS[position.chapterIndex];
  if (chapter === undefined) {
    return null;
  }
  if (position.stageIndex + 1 < chapter.stages.length) {
    return { ...position, stageIndex: position.stageIndex + 1 };
  }
  if (position.chapterIndex + 1 < CHAPTERS.length) {
    return { chapterIndex: position.chapterIndex + 1, stageIndex: 0 };
  }
  return null;
}

export function previousPosition(position: BookPosition): BookPosition | null {
  if (position.stageIndex > 0) {
    return { ...position, stageIndex: position.stageIndex - 1 };
  }
  const previous = CHAPTERS[position.chapterIndex - 1];
  if (previous === undefined) {
    return null;
  }
  return {
    chapterIndex: position.chapterIndex - 1,
    stageIndex: previous.stages.length - 1,
  };
}

// The inverse of stagePath: null for a URL that is not a page of the book.
export function positionFromPath(pathname: string): BookPosition | null {
  const segments = pathname.split("/").filter((s) => s !== "");
  if (segments.length === 0) {
    const chapterIndex = findChapterIndex("introduction");
    return chapterIndex < 0 ? null : { chapterIndex, stageIndex: 0 };
  }
  const [slug, stage] = segments;
  if (slug === undefined || segments.length > 2) {
    return null;
  }
  const chapterIndex = findChapterIndex(slug);
  const chapter = CHAPTERS[chapterIndex];
  if (chapter === undefined) {
    return null;
  }
  const stageIndex = stage === undefined ? 0 : Number(stage) - 1;
  if (
    !Number.isInteger(stageIndex) ||
    stageIndex < 0 ||
    stageIndex >= chapter.stages.length
  ) {
    return null;
  }
  return { chapterIndex, stageIndex };
}
