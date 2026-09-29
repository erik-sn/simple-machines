// The themes are one site with a toggle (PROJECT.md): each one sets the paper,
// the ink, the type, and the stroke character; scenes never know which is on.
export type ThemeId = "ink" | "graph" | "fusion";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: readonly Theme[] = [
  {
    id: "ink",
    name: "Ink on paper",
    description: "Black ink on laid paper, as in a treatise of the 1600s.",
  },
  {
    id: "graph",
    name: "Graph paper",
    description: "Technical pen on a printed grid.",
  },
  {
    id: "fusion",
    name: "Fusion",
    description: "Ink lines over a faint grid.",
  },
];

export const DEFAULT_THEME: ThemeId = "ink";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "ink" || value === "graph" || value === "fusion";
}
