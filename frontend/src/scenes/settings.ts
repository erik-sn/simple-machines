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

export function defaultValues(specs: readonly SettingSpec[]): SettingValues {
  const values: Record<string, number> = {};
  for (const spec of specs) {
    values[spec.key] = spec.defaultValue;
  }
  return values;
}
