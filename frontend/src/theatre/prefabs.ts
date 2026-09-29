import { Box, Vec2 } from "planck";
import type { Machine, SceneDefinition } from "../physics/types";
import { machineScene } from "../scenes/registry";
import type { SettingSpec } from "../scenes/settings";
import type { TheatreKind } from "./composition";

// The bench offers the six machines plus two plain things to hang and hold:
// a weight (the load) and a hook (a point fixed to the page).

const WEIGHT_HALF = 0.16;

const WEIGHT_SETTINGS: readonly SettingSpec[] = [
  {
    key: "mass",
    label: "Mass",
    min: 0.5,
    max: 8,
    step: 0.5,
    defaultValue: 3,
    unit: "kg",
  },
];

const weightScene: SceneDefinition = {
  settings: WEIGHT_SETTINGS,
  camera: { x: 0, y: 0, height: 2, width: 2 },
  build(world, _page, values, _variant, context) {
    const mass = values.mass ?? 3;
    const { origin } = context;
    const pinned = context.pinned === true;
    const body = world.createBody({
      type: pinned ? "static" : "dynamic",
      position: new Vec2(origin.x, origin.y),
      linearDamping: 0.3,
      angularDamping: 1.5,
    });
    body.createFixture(new Box(WEIGHT_HALF, WEIGHT_HALF), {
      density: mass / (4 * WEIGHT_HALF * WEIGHT_HALF),
      friction: 0.5,
    });
    const machine: Machine = {
      parts: [
        {
          id: "block",
          body,
          shapes: [
            {
              kind: "polygon",
              points: [
                { x: -WEIGHT_HALF, y: -WEIGHT_HALF },
                { x: WEIGHT_HALF, y: -WEIGHT_HALF },
                { x: WEIGHT_HALF, y: WEIGHT_HALF },
                { x: -WEIGHT_HALF, y: WEIGHT_HALF },
              ],
              closed: true,
              fill: true,
            },
            {
              kind: "arc",
              center: { x: 0, y: WEIGHT_HALF },
              radius: 0.05,
              start: 0,
              end: Math.PI,
              stroke: "soft",
            },
            // A pinned weight shows the pin that holds it to the page.
            ...(pinned
              ? [
                  {
                    kind: "circle",
                    center: { x: 0, y: 0 },
                    radius: 0.03,
                    stroke: "soft",
                  } as const,
                ]
              : []),
          ],
          grab: pinned ? undefined : { hintAt: { x: 0, y: 0 } },
        },
      ],
      ropes: [],
      statics: [],
      ports: [
        {
          id: "eye",
          kind: "pin",
          part: "block",
          at: { x: 0, y: WEIGHT_HALF + 0.05 },
          role: "load",
        },
        {
          id: "rope-end",
          kind: "ropeEnd",
          part: "block",
          at: { x: 0, y: WEIGHT_HALF + 0.16 },
          role: "load",
        },
        {
          id: "base",
          kind: "face",
          part: "block",
          at: { x: 0, y: -WEIGHT_HALF },
          role: "either",
        },
      ],
      step() {},
      readouts: () => [
        { label: "Weight", value: `${(mass * 9.8).toFixed(0)} N` },
      ],
    };
    return machine;
  },
};

const hookScene: SceneDefinition = {
  settings: [],
  camera: { x: 0, y: 0, height: 1, width: 1 },
  build(_world, _page, _values, _variant, context) {
    const { origin } = context;
    const machine: Machine = {
      parts: [],
      ropes: [],
      statics: [
        {
          kind: "segment",
          from: { x: origin.x - 0.12, y: origin.y + 0.1 },
          to: { x: origin.x + 0.12, y: origin.y + 0.1 },
        },
        {
          kind: "arc",
          center: { x: origin.x, y: origin.y },
          radius: 0.08,
          start: Math.PI,
          end: 2 * Math.PI,
        },
        {
          kind: "segment",
          from: { x: origin.x - 0.08, y: origin.y },
          to: { x: origin.x - 0.08, y: origin.y + 0.1 },
        },
      ],
      ports: [
        {
          id: "anchor",
          kind: "ropeAnchor",
          part: "page",
          at: { x: 0, y: -0.08 },
          role: "either",
        },
        {
          id: "pin",
          kind: "pin",
          part: "page",
          at: { x: 0, y: -0.08 },
          role: "either",
        },
      ],
      step() {},
      readouts: () => [],
    };
    return machine;
  },
};

export function prefabFor(kind: TheatreKind): SceneDefinition {
  switch (kind) {
    case "weight":
      return weightScene;
    case "hook":
      return hookScene;
    default:
      return machineScene(kind);
  }
}

export const PREFAB_LABELS: Readonly<Record<TheatreKind, string>> = {
  lever: "Lever",
  "wheel-and-axle": "Wheel and axle",
  pulley: "Pulley",
  "inclined-plane": "Inclined plane",
  wedge: "Wedge",
  screw: "Screw",
  weight: "Weight",
  hook: "Hook",
};
