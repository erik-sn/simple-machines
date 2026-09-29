import { World } from "planck";
import { renderShape } from "../ink/render";
import { defaultValues } from "../scenes/settings";
import type { ThemeId } from "../theme/themes";
import type { TheatreKind } from "./composition";
import { prefabFor } from "./prefabs";

export interface VignettePath {
  d: string;
  stroke: string;
}

export interface Vignette {
  kind: TheatreKind;
  viewBox: string;
  statics: VignettePath[];
  parts: { id: string; transform: string; paths: VignettePath[] }[];
}

export const VIGNETTE_WIDTH = 84;
export const VIGNETTE_HEIGHT = 56;
const cache = new Map<string, Vignette>();

// A small drawing of a machine at rest for the bench list: the prefab is
// built in a throwaway world and its ink rendered through the theme's pen.
export function vignetteFor(kind: TheatreKind, theme: ThemeId): Vignette {
  const key = `${kind}:${theme}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const definition = prefabFor(kind);
  const world = new World();
  const page = world.createBody();
  const machine = definition.build(
    world,
    page,
    defaultValues(definition.settings),
    undefined,
    { standalone: true, origin: { x: 0, y: 0 } },
  );
  const { camera } = definition;
  const aspect = VIGNETTE_WIDTH / VIGNETTE_HEIGHT;
  const height = Math.max(camera.height, camera.width / aspect);
  const width = height * aspect;
  const pxPerMetre = VIGNETTE_WIDTH / width;
  const statics = machine.statics.flatMap((shape, index) =>
    renderShape(theme, shape, `${kind}:static:${index}`, pxPerMetre).map(
      (path) => ({ d: path.d, stroke: path.stroke }),
    ),
  );
  const parts = machine.parts.map((part) => {
    const p = part.body.getPosition();
    const degrees = (part.body.getAngle() * 180) / Math.PI;
    return {
      id: part.id,
      transform: `translate(${p.x} ${p.y}) rotate(${degrees})`,
      paths: part.shapes.flatMap((shape, index) =>
        renderShape(theme, shape, `${part.id}:${index}`, pxPerMetre).map(
          (path) => ({ d: path.d, stroke: path.stroke }),
        ),
      ),
    };
  });
  const vignette: Vignette = {
    kind,
    viewBox: `${camera.x - width / 2} ${-camera.y - height / 2} ${width} ${height}`,
    statics,
    parts,
  };
  cache.set(key, vignette);
  return vignette;
}
