// template-managed (bootstrap): do not edit. Delete this line to take ownership.
import { useTranslation } from "react-i18next";
import projectFacts from "../../../project.json";

interface Props {
  // The screen's name, already translated.
  screen: string;
}

// Every screen renders one. React 19 hoists <title> into <head> ahead of the
// static one in index.html, so this is what the tab and history show; the
// project name comes from project.json, the one source of identity.
export function PageTitle({ screen }: Props) {
  const { t } = useTranslation();
  return (
    <title>
      {t("common.documentTitle", { screen, app: projectFacts.name })}
    </title>
  );
}
