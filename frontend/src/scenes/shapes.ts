import type { Shape, Vec } from "../physics/types";

// Shapes in body-local metres become SVG path data. The ink renderer replaces
// the straight geometry with a hand's wobble; this is the plain version.

function point(p: Vec): string {
  return `${p.x.toFixed(4)} ${p.y.toFixed(4)}`;
}

export function shapeToPath(shape: Shape): string {
  switch (shape.kind) {
    case "segment":
      return `M ${point(shape.from)} L ${point(shape.to)}`;
    case "polygon": {
      const [first, ...rest] = shape.points;
      if (first === undefined) {
        return "";
      }
      const lines = rest.map((p) => `L ${point(p)}`).join(" ");
      return `M ${point(first)} ${lines}${shape.closed === false ? "" : " Z"}`;
    }
    case "circle": {
      const { center: c, radius: r } = shape;
      return `M ${(c.x - r).toFixed(4)} ${c.y.toFixed(4)} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    case "arc": {
      const { center: c, radius: r, start, end } = shape;
      const from = {
        x: c.x + r * Math.cos(start),
        y: c.y + r * Math.sin(start),
      };
      const to = { x: c.x + r * Math.cos(end), y: c.y + r * Math.sin(end) };
      const large = end - start > Math.PI ? 1 : 0;
      return `M ${point(from)} A ${r} ${r} 0 ${large} 1 ${point(to)}`;
    }
    default: {
      const never: never = shape;
      throw new Error(`Unknown shape ${JSON.stringify(never)}`);
    }
  }
}

export function polylineToPath(points: readonly Vec[]): string {
  const [first, ...rest] = points;
  if (first === undefined) {
    return "";
  }
  return `M ${point(first)} ${rest.map((p) => `L ${point(p)}`).join(" ")}`;
}
