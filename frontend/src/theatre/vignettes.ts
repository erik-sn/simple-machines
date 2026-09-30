import { World } from "planck";
import { renderShape } from "../ink/render";
import type { Machine, Shape, Vec } from "../physics/types";
import { defaultValues } from "../scenes/settings";
import type { ThemeId } from "../theme/themes";
import type { TheatreKind } from "./composition";
import { prefabFor } from "./prefabs";

export interface VignettePath {
  d: string;
  stroke: string;
  fill?: "paper";
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
  // Frame the drawing itself, not the chapter's camera: a machine 4 m tall
  // in a 4.8 m view is a smudge at 80 pixels.
  const box = drawingBounds(machine);
  const aspect = VIGNETTE_WIDTH / VIGNETTE_HEIGHT;
  const pad = 0.08;
  let width = (box.maxX - box.minX) * (1 + 2 * pad);
  let height = (box.maxY - box.minY) * (1 + 2 * pad);
  if (width / height < aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }
  const centreX = (box.minX + box.maxX) / 2;
  const centreY = (box.minY + box.maxY) / 2;
  const pxPerMetre = VIGNETTE_WIDTH / width;
  const statics = machine.statics.flatMap((shape, index) =>
    renderShape(theme, shape, `${kind}:static:${index}`, pxPerMetre).map(
      (path) => ({ d: path.d, stroke: path.stroke, fill: path.fill }),
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
          (path) => ({ d: path.d, stroke: path.stroke, fill: path.fill }),
        ),
      ),
    };
  });
  const vignette: Vignette = {
    kind,
    viewBox: `${centreX - width / 2} ${-centreY - height / 2} ${width} ${height}`,
    statics,
    parts,
  };
  cache.set(key, vignette);
  return vignette;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// The extent of a machine's ink at rest, in world metres.
function drawingBounds(machine: Machine): Bounds {
  const box: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const take = (x: number, y: number) => {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  };
  const takeShape = (shape: Shape, place: (v: Vec) => Vec) => {
    switch (shape.kind) {
      case "segment":
        for (const v of [shape.from, shape.to]) {
          const w = place(v);
          take(w.x, w.y);
        }
        break;
      case "polygon":
        for (const v of shape.points) {
          const w = place(v);
          take(w.x, w.y);
        }
        break;
      case "circle":
      case "arc": {
        const c = place(shape.center);
        take(c.x - shape.radius, c.y - shape.radius);
        take(c.x + shape.radius, c.y + shape.radius);
        break;
      }
      default: {
        const never: never = shape;
        throw new Error(`Unknown shape ${JSON.stringify(never)}`);
      }
    }
  };
  for (const shape of machine.statics) {
    takeShape(shape, (v) => v);
  }
  for (const part of machine.parts) {
    const p = part.body.getPosition();
    const angle = part.body.getAngle();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const shape of part.shapes) {
      takeShape(shape, (v) => ({
        x: p.x + v.x * cos - v.y * sin,
        y: p.y + v.x * sin + v.y * cos,
      }));
    }
  }
  if (!Number.isFinite(box.minX)) {
    return { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 };
  }
  return box;
}
