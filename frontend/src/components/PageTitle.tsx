// Taken over from the template: no i18n in this project (PROJECT.md).
import projectFacts from "../../../project.json";

interface Props {
  // The screen's name; empty on the title page.
  screen?: string;
}

// Every screen renders one. React 19 hoists <title> into <head> ahead of the
// static one in index.html, so this is what the tab and history show; the
// project name comes from project.json, the one source of identity.
export function PageTitle({ screen }: Props) {
  return (
    <title>
      {screen ? `${screen} · ${projectFacts.name}` : projectFacts.name}
    </title>
  );
}
