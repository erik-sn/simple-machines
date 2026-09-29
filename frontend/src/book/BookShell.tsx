import { useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";
import { sceneFor } from "../scenes/registry";
import { Scene } from "../scenes/Scene";
import { defaultValues, type SettingValues } from "../scenes/settings";
import { THEATRE_SETTINGS } from "../theatre/TheatreView";
import { Paper } from "../theme/Paper";
import { AboutPanel } from "./AboutPanel";
import { Caption } from "./Caption";
import { Chrome } from "./Chrome";
import type { Chapter } from "./chapters";
import { ExtraSettingsProvider } from "./extraSettings";
import { NavArrows } from "./NavArrows";
import {
  type BookPosition,
  nextPosition,
  positionPath,
  previousPosition,
} from "./paths";
import { SettingsPanel } from "./SettingsPanel";
import { useKeyboardPaging } from "./useKeyboardPaging";
import { useRecordProgress } from "./useProgress";

interface Props {
  chapter: Chapter;
  position: BookPosition;
}

const SETTINGS_SEEN_KEY = "settings-seen";

// One page of the book: paper, the scene, the placard, and the chrome.
export function BookShell({ chapter, position }: Props) {
  const stage = chapter.stages[position.stageIndex];
  if (stage === undefined) {
    throw new Error(`${chapter.slug} has no stage ${position.stageIndex + 1}`);
  }
  const specs =
    stage.scene.kind === "theatre"
      ? THEATRE_SETTINGS
      : (sceneFor(stage.scene.kind)?.settings ?? []);
  const [values, setValues] = useState<SettingValues>(() =>
    defaultValues(specs),
  );
  const [sceneKind, setSceneKind] = useState(stage.scene.kind);
  if (sceneKind !== stage.scene.kind) {
    // A new machine: its settings start from its own defaults.
    setSceneKind(stage.scene.kind);
    setValues(defaultValues(specs));
  }
  const [panel, setPanel] = useState<"none" | "settings" | "about">("none");
  const [settingsSeen, setSettingsSeen] = useState(
    () => readStorage(SETTINGS_SEEN_KEY) === "true",
  );

  const previous = previousPosition(position);
  const next = nextPosition(position);
  const previousPath = previous === null ? null : positionPath(previous);
  const nextPath = next === null ? null : positionPath(next);
  useKeyboardPaging();
  useRecordProgress(positionPath(position));

  function openSettings() {
    setPanel((current) => (current === "settings" ? "none" : "settings"));
    if (!settingsSeen) {
      setSettingsSeen(true);
      writeStorage(SETTINGS_SEEN_KEY, "true");
    }
  }

  return (
    <ExtraSettingsProvider>
      <div className="relative h-full w-full overflow-hidden">
        <Paper />
        <Scene scene={stage.scene} mode={stage.mode} settings={values} />
        <NavArrows previous={previousPath} next={nextPath} />
        <Caption
          chapter={chapter}
          stage={stage}
          stageIndex={position.stageIndex}
        />
        <Chrome
          showHint={!settingsSeen}
          onOpenSettings={openSettings}
          onOpenAbout={() => setPanel("about")}
        />
        <SettingsPanel
          open={panel === "settings"}
          onClose={() => setPanel("none")}
          specs={specs}
          values={values}
          onChange={(key, value) =>
            setValues((current) => ({ ...current, [key]: value }))
          }
          onReset={() => setValues(defaultValues(specs))}
        />
        <AboutPanel open={panel === "about"} onClose={() => setPanel("none")} />
      </div>
    </ExtraSettingsProvider>
  );
}
