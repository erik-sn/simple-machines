import type { SceneRef, StageMode } from "../book/chapters";
import { TheatreView } from "../theatre/TheatreView";
import { sceneFor } from "./registry";
import { SceneView } from "./SceneView";
import type { SettingValues } from "./settings";

interface Props {
  scene: SceneRef;
  mode: StageMode;
  settings: SettingValues;
  paused: boolean;
}

// Picks the scene definition for a stage. The key remounts the view whenever
// the machine, its settings, or the mode change, so a scene is always built
// fresh from data (a reset is a rebuild, never an in-place undo).
export function Scene({ scene, mode, settings, paused }: Props) {
  if (scene.kind === "theatre") {
    return <TheatreView settings={settings} paused={paused} />;
  }
  const definition = sceneFor(scene.kind);
  if (definition === undefined) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="font-display text-ink-faint text-3xl tracking-wide">
          {scene.kind}
        </p>
      </div>
    );
  }
  const key = `${scene.kind}:${scene.variant ?? ""}:${mode}:${JSON.stringify(settings)}`;
  return (
    <SceneView
      key={key}
      definition={definition}
      scene={scene}
      mode={mode}
      settings={settings}
      paused={paused}
    />
  );
}
