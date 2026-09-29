import type { SceneKind } from "../book/chapters";

// A tunable number the settings panel exposes for a scene. Values are plain
// numbers keyed by `key`; the scene decides what they mean.
export interface SettingSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export type SettingValues = Readonly<Record<string, number>>;

const GRAVITY: SettingSpec = {
  key: "gravity",
  label: "Gravity",
  min: 0,
  max: 20,
  step: 0.5,
  defaultValue: 9.8,
  unit: "m/s²",
};

const FRICTION: SettingSpec = {
  key: "friction",
  label: "Friction",
  min: 0,
  max: 1,
  step: 0.05,
  defaultValue: 0.3,
};

// The physics layer owns the real lists; these are the shared ones every
// machine gets until each scene declares its own.
export const SCENE_SETTINGS: Readonly<
  Record<SceneKind, readonly SettingSpec[]>
> = {
  frontispiece: [GRAVITY],
  lever: [GRAVITY],
  "wheel-and-axle": [GRAVITY],
  pulley: [GRAVITY],
  "inclined-plane": [GRAVITY, FRICTION],
  wedge: [GRAVITY, FRICTION],
  screw: [GRAVITY, FRICTION],
  theatre: [GRAVITY],
};

export function defaultValues(specs: readonly SettingSpec[]): SettingValues {
  const values: Record<string, number> = {};
  for (const spec of specs) {
    values[spec.key] = spec.defaultValue;
  }
  return values;
}
