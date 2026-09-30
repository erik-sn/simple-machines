import rough from "roughjs";
import type { Drawable, OpSet, Options } from "roughjs/bin/core";
import type { Shape, Stroke } from "../physics/types";
import type { ThemeId } from "../theme/themes";

// Shapes in body-local metres become ink: rough.js geometry generated once
// per shape with a seed derived from the part, so the hand's wobble belongs
// to the body and never boils (docs/research/aesthetics.md, 2.2). The graph
// theme runs the same generator at zero roughness, which yields exact lines.
//
// rough.js assumes pixel-sized units (its ellipse jitter is one unit times
// roughness and its hatch gap is clamped to 0.1), so geometry is generated at
// SCALE units per metre and the output is scaled back. Hatching is a pen
// spacing, not a length in the world, so the gap follows the screen scale.

export interface InkPath {
  d: string;
  stroke: Stroke | "hatch";
  // "paper": painted paper-white under the shape's own outline, before its
  // hatch and outline, so it hides whatever was drawn earlier.
  fill?: "paper";
  dash?: "center" | "hidden";
}

const SCALE = 100;
const HATCH_PX = 3.5;
const HATCH_PX_GRAPH = 4;
const generator = rough.generator();

// FNV-1a over the key, folded into rough.js's seed range.
export function seedFrom(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 2147483646) + 1;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

// The longest side of the shape, in metres.
function extentOf(shape: Shape): number {
  switch (shape.kind) {
    case "segment":
      return Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
    case "polygon": {
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const p of shape.points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      return Math.max(maxX - minX, maxY - minY);
    }
    case "circle":
    case "arc":
      return shape.radius * 2;
    default: {
      const never: never = shape;
      throw new Error(`Unknown shape ${JSON.stringify(never)}`);
    }
  }
}

function pen(
  theme: ThemeId,
  seed: number,
  shape: Shape,
  pxPerMetre: number,
): Options {
  // A small mark gets a steadier hand: a pin is the cleanest mark on a plate.
  const k = clamp((extentOf(shape) * SCALE) / 40, 0.3, 1);
  const hatchAngle =
    "hatch" in shape && shape.hatch !== undefined ? shape.hatch.angle : null;
  const shared: Options = {
    seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    preserveVertices: true,
    curveStepCount: 18,
    curveFitting: 0.95,
    fillWeight: 0.5,
    strokeWidth: 1,
  };
  switch (theme) {
    case "ink":
      return {
        ...shared,
        roughness: 0.8 * k,
        bowing: 0.8,
        maxRandomnessOffset: 1.2 * k,
        hachureAngle: hatchAngle ?? -35,
        hachureGap: clamp((HATCH_PX / pxPerMetre) * SCALE, 1.5, 8),
      };
    case "fusion":
      return {
        ...shared,
        roughness: 0.5 * k,
        bowing: 0.4,
        maxRandomnessOffset: 0.8 * k,
        hachureAngle: hatchAngle ?? -35,
        hachureGap: clamp((HATCH_PX / pxPerMetre) * SCALE, 1.5, 8),
      };
    case "graph":
      return {
        ...shared,
        roughness: 0,
        bowing: 0,
        maxRandomnessOffset: 0,
        hachureAngle: hatchAngle ?? 45,
        hachureGap: clamp((HATCH_PX_GRAPH / pxPerMetre) * SCALE, 1.5, 8),
      };
    default: {
      const never: never = theme;
      throw new Error(`No pen for theme ${String(never)}`);
    }
  }
}

function drawableFor(shape: Shape, options: Options): Drawable {
  const filled = "fill" in shape && shape.fill === true;
  // rough.js only hatches when a fill colour is set; the colour itself is
  // ignored, the paths are styled by CSS.
  const fillOptions: Options = filled
    ? { fill: "#000", fillStyle: "hachure" }
    : {};
  const s = SCALE;
  switch (shape.kind) {
    case "segment":
      return generator.line(
        shape.from.x * s,
        shape.from.y * s,
        shape.to.x * s,
        shape.to.y * s,
        options,
      );
    case "polygon": {
      const points = shape.points.map((p): [number, number] => [
        p.x * s,
        p.y * s,
      ]);
      return shape.closed === false
        ? generator.linearPath(points, options)
        : generator.polygon(points, { ...options, ...fillOptions });
    }
    case "circle":
      return generator.circle(
        shape.center.x * s,
        shape.center.y * s,
        shape.radius * 2 * s,
        { ...options, ...fillOptions },
      );
    case "arc":
      return generator.arc(
        shape.center.x * s,
        shape.center.y * s,
        shape.radius * 2 * s,
        shape.radius * 2 * s,
        shape.start,
        shape.end,
        false,
        options,
      );
    default: {
      const never: never = shape;
      throw new Error(`Unknown shape ${JSON.stringify(never)}`);
    }
  }
}

function scaled(value: number): string {
  return (value / SCALE).toFixed(4);
}

// rough.js's op set as SVG path data, back in metres. As a loop, only the
// first move is kept: rough.js draws each edge as its own subpath, but with
// preserveVertices they meet exactly, so dropping the inner moves closes the
// very same wobble into one fillable region.
function opsToPath(set: OpSet, loop = false): string {
  let d = "";
  for (const op of set.ops) {
    const v = op.data;
    switch (op.op) {
      case "move":
        if (loop && d !== "") {
          break;
        }
        d += `M${scaled(v[0] ?? 0)} ${scaled(v[1] ?? 0)} `;
        break;
      case "lineTo":
        d += `L${scaled(v[0] ?? 0)} ${scaled(v[1] ?? 0)} `;
        break;
      case "bcurveTo":
        d += `C${scaled(v[0] ?? 0)} ${scaled(v[1] ?? 0)}, ${scaled(v[2] ?? 0)} ${scaled(v[3] ?? 0)}, ${scaled(v[4] ?? 0)} ${scaled(v[5] ?? 0)} `;
        break;
      default: {
        const never: never = op.op;
        throw new Error(`Unknown rough.js op ${String(never)}`);
      }
    }
  }
  if (loop && d !== "") {
    return `${d.trim()} Z`;
  }
  return d.trim();
}

// pxPerMetre is the screen scale of the scene, so the hatch keeps its pen
// spacing on any viewport; callers quantize it so a resize does not
// regenerate every shape.
export function renderShape(
  theme: ThemeId,
  shape: Shape,
  key: string,
  pxPerMetre = 200,
): InkPath[] {
  const drawable = drawableFor(
    shape,
    pen(theme, seedFrom(key), shape, pxPerMetre),
  );
  const stroke = shape.stroke ?? "ink";
  const outline = !("outline" in shape) || shape.outline !== false;
  const paths: InkPath[] = [];
  if ("opaque" in shape && shape.opaque === true) {
    const edge = drawable.sets.find((set) => set.type === "path");
    if (edge === undefined) {
      throw new Error(`Opaque shape without an outline: ${shape.kind}`);
    }
    paths.push({ d: opsToPath(edge, true), stroke, fill: "paper" });
  }
  for (const set of drawable.sets) {
    if (set.type === "path" && !outline) {
      continue;
    }
    const d = opsToPath(set);
    if (d === "") {
      continue;
    }
    const path: InkPath = {
      d,
      stroke: set.type === "fillSketch" ? "hatch" : stroke,
    };
    if (shape.dash !== undefined) {
      path.dash = shape.dash;
    }
    paths.push(path);
  }
  return paths;
}

// The pointing hand of a Renaissance margin (a manicule): drawn in ink at the
// place the reader may take hold. In a 40 by 28 box, finger to the right.
export const MANICULE_PATH =
  "M 9 8 C 12 5, 18 5, 21 8 L 36 7.5 C 38.5 7.5, 38.5 11, 36 11 L 22 11.5 C 22.5 13.5, 21 15, 19 15.5 C 21 17.5, 20 19.5, 18 20 C 19 22, 17.5 24, 15 24 C 12 24, 10 22.5, 9 21 Z M 2 7 L 9 7 L 9 22 L 2 22 Z M 19 15.5 L 14 15.5 M 18 20 L 13.5 20";
