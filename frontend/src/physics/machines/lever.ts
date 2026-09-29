import { Box, RevoluteJoint, RopeJoint, Vec2 } from "planck";
import type { SettingSpec, SettingValues } from "../../scenes/settings";
import { ForceSampler } from "../sampler";
import type {
  Machine,
  MachineModule,
  Part,
  SceneDefinition,
  Script,
  Shape,
  Vec,
} from "../types";

// The lever: a bar on a pin, a load hung from one point, the hand on another
// (docs/research/physics.md, "Lever"). The three classes are presets of where
// the fulcrum, load, and effort sit along the bar.

const BAR_HALF_THICKNESS = 0.03;
const BAR_DENSITY = 4;
const ROPE_LENGTH = 0.5;
const WEIGHT_HALF = 0.16;
const TILT_LIMIT = 0.45;

interface Layout {
  // Fractions of the bar length from its left end.
  fulcrum: number;
  load: number;
  effort: number;
}

function layoutFor(values: SettingValues, variant: string | undefined): Layout {
  const fulcrum = values.fulcrum ?? 0.3;
  switch (variant) {
    case "class2":
      // Wheelbarrow: fulcrum at one end, load between, effort at the far end.
      return { fulcrum: 0.03, load: fulcrum, effort: 0.97 };
    case "class3":
      // Tweezers: fulcrum at one end, effort between, load at the far end.
      return { fulcrum: 0.03, load: 0.97, effort: fulcrum };
    default:
      // Seesaw: load at one end, fulcrum between, effort at the other end.
      return { fulcrum, load: 0.05, effort: 0.95 };
  }
}

export const LEVER_SETTINGS: readonly SettingSpec[] = [
  {
    key: "length",
    label: "Bar length",
    min: 1.5,
    max: 4,
    step: 0.1,
    defaultValue: 3,
    unit: "m",
  },
  {
    key: "fulcrum",
    label: "Fulcrum position",
    min: 0.1,
    max: 0.9,
    step: 0.01,
    defaultValue: 0.3,
  },
  {
    key: "load",
    label: "Load",
    min: 0.5,
    max: 8,
    step: 0.5,
    defaultValue: 5,
    unit: "kg",
  },
  {
    key: "pinFriction",
    label: "Pin friction",
    min: 0,
    max: 3,
    step: 0.1,
    defaultValue: 0,
    unit: "N·m",
  },
  {
    key: "gravity",
    label: "Gravity",
    min: 1,
    max: 20,
    step: 0.5,
    defaultValue: 9.8,
    unit: "m/s²",
  },
];

function formatNewtons(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} N`;
}

export const leverScene: SceneDefinition = {
  settings: LEVER_SETTINGS,
  camera: { x: 0, y: -0.2, height: 4, width: 4.6 },
  build(world, page, values, variant, context) {
    const length = values.length ?? 3;
    const loadMass = values.load ?? 5;
    const gravity = values.gravity ?? 9.8;
    const pinFriction = values.pinFriction ?? 0;
    const layout = layoutFor(values, variant);
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);
    const xAt = (fraction: number) => -length / 2 + fraction * length;
    const xFulcrum = xAt(layout.fulcrum);
    const xLoad = xAt(layout.load);
    const xEffort = xAt(layout.effort);

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    const bar = world.createBody({ type: "dynamic", position: at(0, 0) });
    bar.createFixture(new Box(length / 2, BAR_HALF_THICKNESS), {
      density: BAR_DENSITY,
      friction: 0.5,
    });
    const pin = world.createJoint(
      new RevoluteJoint(
        {
          enableMotor: true,
          motorSpeed: 0,
          maxMotorTorque: pinFriction,
          enableLimit: true,
          lowerAngle: -TILT_LIMIT,
          upperAngle: TILT_LIMIT,
        },
        page,
        bar,
        at(xFulcrum, 0),
      ),
    );
    if (pin === null) {
      throw new Error("The world refused the lever's pin");
    }

    // The chapter hangs its own weight; the Theatre leaves the load end free.
    const weightY = -BAR_HALF_THICKNESS - ROPE_LENGTH - WEIGHT_HALF;
    const weight = context.standalone
      ? world.createBody({
          type: "dynamic",
          position: at(xLoad, weightY),
          linearDamping: 0.5,
          angularDamping: 2,
        })
      : null;
    if (weight !== null) {
      weight.createFixture(new Box(WEIGHT_HALF, WEIGHT_HALF), {
        density: loadMass / (4 * WEIGHT_HALF * WEIGHT_HALF),
        friction: 0.5,
      });
      world.createJoint(
        new RopeJoint({
          bodyA: bar,
          bodyB: weight,
          localAnchorA: new Vec2(xLoad, -BAR_HALF_THICKNESS),
          localAnchorB: new Vec2(0, WEIGHT_HALF),
          maxLength: ROPE_LENGTH,
        }),
      );
    }

    const barPart: Part = {
      id: "bar",
      body: bar,
      shapes: [
        {
          kind: "polygon",
          points: [
            { x: -length / 2, y: -BAR_HALF_THICKNESS },
            { x: length / 2, y: -BAR_HALF_THICKNESS },
            { x: length / 2, y: BAR_HALF_THICKNESS },
            { x: -length / 2, y: BAR_HALF_THICKNESS },
          ],
          closed: true,
          fill: true,
        },
        // The pin, drawn on the bar so it stays centred on the joint.
        { kind: "circle", center: { x: xFulcrum, y: 0 }, radius: 0.045 },
      ],
      grab: { hintAt: { x: xEffort, y: 0 } },
    };
    const weightPart: Part | null =
      weight === null
        ? null
        : {
            id: "weight",
            body: weight,
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
              // A ring on top for the rope.
              {
                kind: "arc",
                center: { x: 0, y: WEIGHT_HALF },
                radius: 0.05,
                start: 0,
                end: Math.PI,
                stroke: "soft",
              },
            ],
          };

    const fulcrumStand: Shape = {
      kind: "polygon",
      points: [
        { x: origin.x + xFulcrum - 0.22, y: origin.y - 0.5 },
        { x: origin.x + xFulcrum + 0.22, y: origin.y - 0.5 },
        { x: origin.x + xFulcrum, y: origin.y - 0.04 },
      ],
      closed: true,
      fill: true,
    };
    const baseLine: Shape = {
      kind: "segment",
      from: { x: origin.x + xFulcrum - 0.35, y: origin.y - 0.5 },
      to: { x: origin.x + xFulcrum + 0.35, y: origin.y - 0.5 },
      stroke: "soft",
    };

    const effortSampler = new ForceSampler();
    let effortNow = 0;

    const ropeFrom = (): Vec => {
      const p = bar.getWorldPoint(new Vec2(xLoad, -BAR_HALF_THICKNESS));
      return { x: p.x, y: p.y };
    };
    const ropeTo = (): Vec => {
      if (weight === null) {
        return ropeFrom();
      }
      const p = weight.getWorldPoint(new Vec2(0, WEIGHT_HALF + 0.05));
      return { x: p.x, y: p.y };
    };

    const machine: Machine = {
      parts: weightPart === null ? [barPart] : [barPart, weightPart],
      ropes:
        weight === null
          ? []
          : [{ id: "rope", strands: () => [[ropeFrom(), ropeTo()]] }],
      statics: [fulcrumStand, baseLine],
      ports: [
        {
          id: "load-end",
          kind: "pin",
          part: "bar",
          at: { x: xLoad, y: 0 },
          role: "load",
        },
        {
          id: "effort-end",
          kind: "pin",
          part: "bar",
          at: { x: xEffort, y: 0 },
          role: "effort",
        },
        {
          id: "load-hook",
          kind: "ropeAnchor",
          part: "bar",
          at: { x: xLoad, y: -BAR_HALF_THICKNESS },
          role: "load",
        },
      ],
      step(context) {
        if (context.handPart === barPart) {
          // Effort is the hand's force across the bar, the part that turns it.
          const along = bar.getWorldVector(new Vec2(1, 0));
          const across =
            -context.handForce.x * along.y + context.handForce.y * along.x;
          effortSampler.push(Math.abs(across));
          effortNow = effortSampler.mean();
        } else {
          effortSampler.clear();
          effortNow = 0;
        }
      },
      readouts() {
        const loadArm = Math.abs(xFulcrum - xLoad);
        const effortArm = Math.abs(xEffort - xFulcrum);
        const ideal = effortArm / loadArm;
        const loadForce = (weight?.getMass() ?? 0) * gravity;
        const settled =
          (weight?.getLinearVelocity().length() ?? 0) < 0.08 &&
          Math.abs(bar.getAngularVelocity()) < 0.08;
        const readouts = [
          { label: "Load", value: formatNewtons(loadForce) },
          { label: "Ideal advantage", value: ideal.toFixed(1) },
        ];
        if (effortNow > 0.5) {
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          readouts.push({
            label: "Advantage",
            value: settled ? (loadForce / effortNow).toFixed(1) : "moving",
          });
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const length = values.length ?? 3;
    const layout = layoutFor(values, variant);
    return {
      partId: "bar",
      at: { x: -length / 2 + layout.effort * length, y: 0 },
    };
  },
  script(values, variant): Script {
    const length = values.length ?? 3;
    const layout = layoutFor(values, variant);
    const x = -length / 2 + layout.effort * length;
    const down = variant === "class3" ? -0.35 : -0.75;
    return {
      partId: "bar",
      frames: [
        { step: 0, x, y: 0 },
        { step: 40, x, y: 0 },
        { step: 160, x, y: down },
        { step: 260, x, y: down },
        { step: 360, x, y: 0.05 },
        { step: 420, x, y: 0.05 },
      ],
      rest: 60,
    };
  },
};

export const machine: MachineModule = { kind: "lever", scene: leverScene };
