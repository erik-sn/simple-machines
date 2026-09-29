import { Navigate, useParams } from "react-router";
import { BookShell } from "../book/BookShell";
import { CHAPTERS } from "../book/chapters";
import { findChapterIndex } from "../book/paths";
import { PageTitle } from "../components/PageTitle";

interface Props {
  // Fixed slug for the "/" route; otherwise read from the URL.
  slug?: string;
}

// Resolves the URL to a chapter and stage; anything unknown returns to the
// title page.
export function ChapterPage({ slug }: Props) {
  const params = useParams<{ slug?: string; stage?: string }>();
  const chapterSlug = slug ?? params.slug ?? "";
  const chapterIndex = findChapterIndex(chapterSlug);
  const chapter = CHAPTERS[chapterIndex];
  if (chapter === undefined) {
    return <Navigate to="/" replace />;
  }
  const stageNumber = params.stage === undefined ? 1 : Number(params.stage);
  const stageIndex = stageNumber - 1;
  if (
    !Number.isInteger(stageIndex) ||
    stageIndex < 0 ||
    stageIndex >= chapter.stages.length
  ) {
    return <Navigate to="/" replace />;
  }
  return (
    <>
      <PageTitle
        screen={chapter.kind === "introduction" ? undefined : chapter.title}
      />
      <BookShell
        key={chapter.slug}
        chapter={chapter}
        position={{ chapterIndex, stageIndex }}
      />
    </>
  );
}
