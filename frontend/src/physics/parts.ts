import type { Shape, Vec } from "./types";

// The one object on every plate: a block seen a little from above and the
// right, front plain, top plain, right face hatched, a ring on top for the
// rope. Opaque, so it sits in front of ropes and threads.
export interface BlockOptions {
  halfWidth: number;
  halfHeight: number;
  ring?: boolean;
  opaque?: boolean;
}

function depth(halfWidth: number): { dx: number; dy: number } {
  const dx = Math.min(0.12, Math.max(0.06, 0.4 * halfWidth));
  return { dx, dy: 0.7 * dx };
}

export function blockShapes({
  halfWidth,
  halfHeight,
  ring = true,
  opaque = true,
}: BlockOptions): Shape[] {
  const { dx, dy } = depth(halfWidth);
  const shapes: Shape[] = [
    {
      kind: "polygon",
      points: [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
      ],
      closed: true,
      opaque,
    },
    {
      kind: "polygon",
      points: [
        { x: -halfWidth, y: halfHeight },
        { x: -halfWidth + dx, y: halfHeight + dy },
        { x: halfWidth + dx, y: halfHeight + dy },
        { x: halfWidth, y: halfHeight },
      ],
      closed: true,
      opaque,
    },
    {
      kind: "polygon",
      points: [
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth + dx, y: -halfHeight + dy },
        { x: halfWidth + dx, y: halfHeight + dy },
        { x: halfWidth, y: halfHeight },
      ],
      closed: true,
      fill: true,
      opaque,
      hatch: { angle: 70 },
    },
  ];
  if (ring) {
    shapes.push({
      kind: "circle",
      center: { x: 0.035, y: halfHeight + dy },
      radius: 0.05,
      stroke: "soft",
    });
  }
  return shapes;
}

// Where a rope ties into the block's ring, in the block's local frame.
export function blockRingPoint(halfWidth: number, halfHeight: number): Vec {
  const { dy } = depth(halfWidth);
  return { x: 0.035, y: halfHeight + dy + 0.05 };
}
