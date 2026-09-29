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
// SCALE units per metre and the output is scaled back.

export interface InkPath {
  d: string;
  stroke: Stroke | "hatch";
  fill: boolean;
}

const SCALE = 100;
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

function pen(theme: ThemeId, seed: number): Options {
  const shared: Options = {
    seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    preserveVertices: true,
    curveStepCount: 18,
    curveFitting: 0.95,
    hachureAngle: -35,
    hachureGap: 2.2,
    fillWeight: 0.5,
    strokeWidth: 1,
  };
  switch (theme) {
    case "ink":
      return {
        ...shared,
        roughness: 0.8,
        bowing: 0.8,
        maxRandomnessOffset: 1.2,
      };
    case "fusion":
      return {
        ...shared,
        roughness: 0.4,
        bowing: 0.4,
        maxRandomnessOffset: 0.8,
      };
    case "graph":
      return {
        ...shared,
        roughness: 0,
        bowing: 0,
        maxRandomnessOffset: 0,
        hachureAngle: 45,
        hachureGap: 3.5,
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

// rough.js's op set as SVG path data, back in metres.
function opsToPath(set: OpSet): string {
  let d = "";
  for (const op of set.ops) {
    const v = op.data;
    switch (op.op) {
      case "move":
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
  return d.trim();
}

export function renderShape(
  theme: ThemeId,
  shape: Shape,
  key: string,
): InkPath[] {
  const drawable = drawableFor(shape, pen(theme, seedFrom(key)));
  const stroke = shape.stroke ?? "ink";
  const paths: InkPath[] = [];
  for (const set of drawable.sets) {
    const d = opsToPath(set);
    if (d === "") {
      continue;
    }
    paths.push({
      d,
      stroke: set.type === "fillSketch" ? "hatch" : stroke,
      fill: set.type === "fillPath",
    });
  }
  return paths;
}
