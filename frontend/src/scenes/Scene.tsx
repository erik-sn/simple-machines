import type { SceneRef, StageMode } from "../book/chapters";
import type { SettingValues } from "./settings";

interface Props {
  scene: SceneRef;
  mode: StageMode;
  settings: SettingValues;
}

// The illustration layer, full viewport. Until the physics and ink layers land
// this draws the machine's name in the display face.
export function Scene({ scene, mode, settings }: Props) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      data-scene={scene.kind}
      data-mode={mode}
      data-gravity={settings.gravity}
    >
      <p className="font-display text-ink-faint text-3xl tracking-wide">
        {scene.kind}
      </p>
    </div>
  );
}
