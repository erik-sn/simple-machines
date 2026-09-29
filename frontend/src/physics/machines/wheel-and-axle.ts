import {
  type Body,
  Box,
  Circle,
  GearJoint,
  MouseJoint,
  PrismaticJoint,
  RevoluteJoint,
  Vec2,
  type World,
} from "planck";
import type { SettingSpec, SettingValues } from "../../scenes/settings";
import { ForceSampler } from "../sampler";
import type {
  Keyframe,
  Machine,
  MachineModule,
  Part,
  Readout,
  SceneDefinition,
  Script,
  Shape,
  Vec,
} from "../types";

// The wheel and axle: a wheel and a smaller drum fixed together and pinned at
// their shared centre, the load wound on the drum, the hand on the rim
// (docs/research/physics.md, "Wheel and axle"). The rope is never simulated:
// a gear joint binds the wheel's pin to the load's vertical guide so that a
// turn of dθ winds r dθ of rope, and the rope is drawn from that geometry each
// frame. The windlass is the same body with a crank arm in place of the wheel.

const WHEEL_DENSITY = 0.9;
// A small iron drum still needs mass for the solver to work against.
const DRUM_DENSITY = 5;
const RIM_WIDTH = 0.07;
const HUB_RADIUS = 0.09;
const SPOKES = 8;
const CRANK_HALF_WIDTH = 0.035;
// The crank is drawn light: its own weight off the pin would help or hinder
// the hand by its angle and muddle the measured advantage.
const CRANK_DENSITY = 0.5;
// The shaft's mass sits on the pin, adds no torque, and keeps the hand firm
// (its spring scales with the body's mass) even on a tiny drum with a crank.
const SHAFT_RADIUS = 0.05;
const SHAFT_MASS = 1.5;
const KNOB_RADIUS = 0.06;
// Where the crank points, and where the demonstration takes the rim.
const CRANK_ANGLE = 0.7;
// The drum is drawn this much inside its true radius so the rope wound on it
// sits exactly at r, the radius the physics uses.
const ROPE_INSET = 0.012;
// Rope on the drum at rest, in radians; unwinding stops at the guide's limit
// before it runs out, and winding past a full turn draws no more.
const BASE_WRAP = 1.25 * Math.PI;
const MAX_WRAP = 1.9 * Math.PI;
const HOOK_RADIUS = 0.055;
const HOOK_STEM = 0.05;
const HOOK_DENSITY = 30;
const WEIGHT_HALF = 0.14;
const BLOCK_TOP = -(HOOK_RADIUS + HOOK_STEM);
// Heavier loads keep this body mass and are faked with gravityScale, which
// keeps the wheel and the load within the solver's comfortable mass ratio.
const LOAD_BODY_CAP = 4;
// How far the load may pay out below its rest before the rope runs out.
const DROP_LIMIT = 0.2;
const HOOK_CLEARANCE = 0.06;
const TURN = (100 * Math.PI) / 180;
const PIN_RADIUS = 0.035;
// Fixtures of one machine never touch: in this side view the rope and the
// load hang in front of the wheel's face.
const GROUP = -2;
const ZERO: Vec = { x: 0, y: 0 };

interface Layout {
  // A crank arm at the wheel's radius in place of the full wheel.
  crank: boolean;
  // Where the hand takes hold on the circle of radius R, radians from +x.
  hintAngle: number;
  scriptAngle: number;
}

function layoutFor(variant: string | undefined): Layout {
  switch (variant) {
    case "windlass":
      // A well windlass: the crank is the only place to take hold.
      return { crank: true, hintAngle: CRANK_ANGLE, scriptAngle: CRANK_ANGLE };
    default:
      // The textbook wheel: the hint sits on the rim's right-hand side; the
      // demonstration takes the rim higher and pulls it down and round.
      return { crank: false, hintAngle: 0, scriptAngle: CRANK_ANGLE };
  }
}

export const WHEEL_AND_AXLE_SETTINGS: readonly SettingSpec[] = [
  {
    key: "wheelRadius",
    label: "Wheel radius",
    min: 0.4,
    max: 1.2,
    step: 0.05,
    defaultValue: 0.9,
    unit: "m",
  },
  {
    key: "axleRadius",
    label: "Axle radius",
    min: 0.06,
    max: 0.4,
    step: 0.01,
    defaultValue: 0.25,
    unit: "m",
  },
  {
    key: "load",
    label: "Load",
    min: 0.5,
    max: 8,
    step: 0.5,
    defaultValue: 4,
    unit: "kg",
  },
  {
    key: "bearingFriction",
    label: "Bearing friction",
    min: 0,
    max: 2,
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

function radii(values: SettingValues): {
  wheelRadius: number;
  axleRadius: number;
} {
  return {
    wheelRadius: values.wheelRadius ?? 0.9,
    axleRadius: values.axleRadius ?? 0.25,
  };
}

// The hook's ring centre at rest: below the rim when the wheel is the larger
// circle, otherwise a rope's length below the drum.
function hookRestY(wheelRadius: number, axleRadius: number): number {
  return -Math.max(wheelRadius + 0.18, axleRadius + 0.6);
}

function onCircle(radius: number, angle: number): Vec {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function formatNewtons(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} N`;
}

function formatMetres(value: number): string {
  return `${value.toFixed(2)} m`;
}

// The point the hand holds on the body: the mouse joint's anchor, found in
// the world's joint list because the hand keeps its joint to itself.
function handAnchorOn(world: World, body: Body): Vec2 {
  for (
    let joint = world.getJointList();
    joint !== null;
    joint = joint.getNext()
  ) {
    if (joint.getType() === MouseJoint.TYPE && joint.getBodyB() === body) {
      return joint.getAnchorB();
    }
  }
  throw new Error("The hand holds the wheel but has no joint on it");
}

function wheelShapes(
  wheelRadius: number,
  axleRadius: number,
  layout: Layout,
): Shape[] {
  const shapes: Shape[] = [];
  if (layout.crank) {
    const tip = onCircle(wheelRadius, layout.hintAngle);
    const across = onCircle(CRANK_HALF_WIDTH, layout.hintAngle + Math.PI / 2);
    shapes.push(
      {
        kind: "polygon",
        points: [
          across,
          { x: tip.x + across.x, y: tip.y + across.y },
          { x: tip.x - across.x, y: tip.y - across.y },
          { x: -across.x, y: -across.y },
        ],
        closed: true,
        fill: true,
      },
      { kind: "circle", center: tip, radius: KNOB_RADIUS, fill: true },
    );
  } else {
    shapes.push(
      { kind: "circle", center: ZERO, radius: wheelRadius },
      {
        kind: "circle",
        center: ZERO,
        radius: wheelRadius - RIM_WIDTH,
        stroke: "soft",
      },
    );
    const inner = Math.max(HUB_RADIUS, axleRadius) + 0.01;
    const outer = wheelRadius - RIM_WIDTH;
    if (outer - inner > 0.05) {
      for (let i = 0; i < SPOKES; i += 1) {
        const angle = ((i + 0.5) * 2 * Math.PI) / SPOKES;
        shapes.push({
          kind: "segment",
          from: onCircle(inner, angle),
          to: onCircle(outer, angle),
        });
      }
    }
    if (axleRadius < HUB_RADIUS) {
      shapes.push({ kind: "circle", center: ZERO, radius: HUB_RADIUS });
    }
  }
  // The drum, a solid cylinder end; its hatching turns with it.
  shapes.push({
    kind: "circle",
    center: ZERO,
    radius: axleRadius - ROPE_INSET,
    fill: true,
  });
  return shapes;
}

function hookShapes(standalone: boolean): Shape[] {
  const shapes: Shape[] = [
    // A crook the rope's end hangs in, its stem down to the load.
    {
      kind: "segment",
      from: { x: HOOK_RADIUS, y: BLOCK_TOP },
      to: { x: HOOK_RADIUS, y: 0 },
    },
    {
      kind: "arc",
      center: ZERO,
      radius: HOOK_RADIUS,
      start: 0,
      end: Math.PI + 0.5,
    },
  ];
  if (standalone) {
    shapes.push({
      kind: "polygon",
      points: [
        { x: -WEIGHT_HALF, y: BLOCK_TOP },
        { x: WEIGHT_HALF, y: BLOCK_TOP },
        { x: WEIGHT_HALF, y: BLOCK_TOP - 2 * WEIGHT_HALF },
        { x: -WEIGHT_HALF, y: BLOCK_TOP - 2 * WEIGHT_HALF },
      ],
      closed: true,
      fill: true,
    });
  }
  return shapes;
}

// Appends keyframes along the circle from one angle to another, eased so the
// hand starts and stops gently; one chord across the whole arc would drag the
// wheel against its pin.
function sweep(
  frames: Keyframe[],
  radius: number,
  from: number,
  to: number,
  until: number,
): void {
  const last = frames[frames.length - 1];
  if (last === undefined) {
    throw new Error("A sweep needs a keyframe to start from");
  }
  const steps = until - last.step;
  const pieces = Math.max(1, Math.round(Math.abs(to - from) / (Math.PI / 36)));
  for (let i = 1; i <= pieces; i += 1) {
    const fraction = i / pieces;
    const eased = (1 - Math.cos(Math.PI * fraction)) / 2;
    frames.push({
      step: last.step + Math.round(steps * fraction),
      ...onCircle(radius, from + (to - from) * eased),
    });
  }
}

export const wheelAndAxleScene: SceneDefinition = {
  settings: WHEEL_AND_AXLE_SETTINGS,
  // The wheel sits high so the load hangs clear of the caption; the width
  // is the widest wheel plus its hint ring, so phones show it large.
  camera: { x: 0, y: -1.08, height: 4.8, width: 3.4 },
  build(world, page, values, variant, context) {
    const { wheelRadius, axleRadius } = radii(values);
    const loadMass = values.load ?? 4;
    const bearingFriction = values.bearingFriction ?? 0;
    const gravity = values.gravity ?? 9.8;
    const layout = layoutFor(variant);
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);
    const hookY = hookRestY(wheelRadius, axleRadius);

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    const wheel = world.createBody({
      type: "dynamic",
      position: at(0, 0),
      angularDamping: 0.2,
    });
    wheel.createFixture(new Circle(axleRadius), {
      density: DRUM_DENSITY,
      filterGroupIndex: GROUP,
    });
    wheel.createFixture(new Circle(SHAFT_RADIUS), {
      density: SHAFT_MASS / (Math.PI * SHAFT_RADIUS * SHAFT_RADIUS),
      filterGroupIndex: GROUP,
    });
    if (layout.crank) {
      const middle = onCircle(wheelRadius / 2, layout.hintAngle);
      const tip = onCircle(wheelRadius, layout.hintAngle);
      wheel.createFixture(
        new Box(
          wheelRadius / 2,
          CRANK_HALF_WIDTH,
          new Vec2(middle.x, middle.y),
          layout.hintAngle,
        ),
        { density: CRANK_DENSITY, filterGroupIndex: GROUP },
      );
      wheel.createFixture(new Circle(new Vec2(tip.x, tip.y), KNOB_RADIUS), {
        density: CRANK_DENSITY,
        filterGroupIndex: GROUP,
      });
    } else {
      wheel.createFixture(new Circle(wheelRadius), {
        density: WHEEL_DENSITY,
        filterGroupIndex: GROUP,
      });
    }
    // The bearing: the motor at speed zero is its friction.
    const hub = world.createJoint(
      new RevoluteJoint(
        { enableMotor: true, motorSpeed: 0, maxMotorTorque: bearingFriction },
        page,
        wheel,
        wheel.getPosition(),
      ),
    );
    if (hub === null) {
      throw new Error("The world refused the wheel's pin");
    }

    // The rope leaves the drum at its left tangent and hangs straight down,
    // so the hook rides a vertical guide there. The chapter hangs its weight
    // on the hook; the Theatre leaves the hook bare for whatever attaches.
    const hook = world.createBody({
      type: "dynamic",
      position: at(-axleRadius, hookY),
      linearDamping: 0.5,
    });
    hook.createFixture(new Circle(HOOK_RADIUS), {
      density: HOOK_DENSITY,
      filterGroupIndex: GROUP,
    });
    if (context.standalone) {
      const bodyMass = Math.min(loadMass, LOAD_BODY_CAP);
      hook.createFixture(
        new Box(WEIGHT_HALF, WEIGHT_HALF, new Vec2(0, BLOCK_TOP - WEIGHT_HALF)),
        {
          density: bodyMass / (4 * WEIGHT_HALF * WEIGHT_HALF),
          filterGroupIndex: GROUP,
        },
      );
      hook.setGravityScale(loadMass / hook.getMass());
    }
    const guide = world.createJoint(
      new PrismaticJoint(
        {
          enableLimit: true,
          lowerTranslation: -DROP_LIMIT,
          upperTranslation: -axleRadius - HOOK_CLEARANCE - HOOK_RADIUS - hookY,
        },
        page,
        hook,
        hook.getPosition(),
        new Vec2(0, 1),
      ),
    );
    if (guide === null) {
      throw new Error("The world refused the load's guide");
    }
    // angle + (1 / r) * translation is constant: turning the wheel clockwise
    // by dθ lifts the load by r dθ, and the load's weight torques the wheel
    // by exactly its tension times r.
    const gear = world.createJoint(
      new GearJoint({}, wheel, hook, hub, guide, 1 / axleRadius),
    );
    if (gear === null) {
      throw new Error("The world refused the gear between wheel and load");
    }

    const wheelPart: Part = {
      id: "wheel",
      body: wheel,
      shapes: wheelShapes(wheelRadius, axleRadius, layout),
      grab: { hintAt: onCircle(wheelRadius, layout.hintAngle) },
    };
    const hookPart: Part = {
      id: "hook",
      body: hook,
      shapes: hookShapes(context.standalone),
    };
    const pin: Shape = {
      kind: "circle",
      center: at(0, 0),
      radius: PIN_RADIUS,
      stroke: "soft",
    };

    const effortSampler = new ForceSampler();
    const tensionSampler = new ForceSampler();
    let effortNow = 0;

    // The wound rope: an arc on the drum from the winding angle, clockwise
    // over the top to the left tangent, then a straight strand to the hook.
    const ropeStrands = (): readonly (readonly Vec[])[] => {
      const centre = wheel.getPosition();
      const wound = -wheel.getAngle();
      const wrap = Math.min(MAX_WRAP, Math.max(0, BASE_WRAP + wound));
      const pieces = Math.max(1, Math.ceil(wrap / (Math.PI / 18)));
      const points: Vec[] = [];
      for (let i = 0; i <= pieces; i += 1) {
        const angle = Math.PI - wrap + (wrap * i) / pieces;
        points.push({
          x: centre.x + axleRadius * Math.cos(angle),
          y: centre.y + axleRadius * Math.sin(angle),
        });
      }
      const end = hook.getWorldPoint(new Vec2(0, HOOK_RADIUS));
      points.push({ x: end.x, y: end.y });
      return [points];
    };

    const machine: Machine = {
      parts: [wheelPart, hookPart],
      ropes: [{ id: "rope", strands: ropeStrands }],
      statics: [pin],
      ports: [
        {
          id: "rim",
          kind: "handle",
          part: "wheel",
          at: onCircle(wheelRadius, layout.hintAngle),
          role: "effort",
        },
        {
          id: "rope-end",
          kind: "ropeEnd",
          part: "hook",
          at: ZERO,
          role: "load",
        },
        { id: "shaft", kind: "shaft", part: "wheel", at: ZERO, role: "either" },
      ],
      step(context) {
        if (context.handPart === wheelPart) {
          // Only the part of the hand's force across the radius turns the
          // wheel; a hold at the very centre has no leverage to measure.
          const anchor = handAnchorOn(world, wheel);
          const centre = wheel.getPosition();
          const rx = anchor.x - centre.x;
          const ry = anchor.y - centre.y;
          const radius = Math.hypot(rx, ry);
          const tangential =
            radius < 0.05
              ? 0
              : (-ry * context.handForce.x + rx * context.handForce.y) / radius;
          effortSampler.push(Math.abs(tangential));
          effortNow = effortSampler.mean();
        } else {
          effortSampler.clear();
          effortNow = 0;
        }
        // The gear's torque on the wheel is the rope's tension times r.
        tensionSampler.push(
          Math.abs(gear.getReactionTorque(1 / context.dt)) / axleRadius,
        );
      },
      readouts() {
        const loadForce = context.standalone
          ? loadMass * gravity
          : tensionSampler.mean();
        const settled = Math.abs(wheel.getAngularVelocity()) < 0.08;
        const readouts: Readout[] = [
          { label: "Load", value: formatNewtons(loadForce) },
          {
            label: "Ideal advantage",
            value: (wheelRadius / axleRadius).toFixed(1),
          },
        ];
        if (effortNow > 0.5) {
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          readouts.push({
            label: "Advantage",
            value: settled ? (loadForce / effortNow).toFixed(1) : "moving",
          });
        }
        // The trade: the rim travels R dθ for the r dθ the load rises.
        const rim = -wheel.getAngle() * wheelRadius;
        const rise = guide.getJointTranslation();
        if (Math.abs(rim) >= 0.01) {
          readouts.push({
            label: "Rope out",
            value: `${formatMetres(Math.abs(rise))} ${rise < 0 ? "down" : "up"} for ${formatMetres(Math.abs(rim))} of rim`,
          });
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const { wheelRadius } = radii(values);
    return {
      partId: "wheel",
      at: onCircle(wheelRadius, layoutFor(variant).hintAngle),
    };
  },
  script(values, variant): Script {
    const { wheelRadius } = radii(values);
    const start = layoutFor(variant).scriptAngle;
    const lifted = start - TURN;
    const frames: Keyframe[] = [{ step: 0, ...onCircle(wheelRadius, start) }];
    // Take hold, pull the rim down and round so the load rises, hold, let it
    // back up, hold; then the scene replays.
    sweep(frames, wheelRadius, start, start, 30);
    sweep(frames, wheelRadius, start, lifted, 330);
    sweep(frames, wheelRadius, lifted, lifted, 440);
    sweep(frames, wheelRadius, lifted, start, 740);
    return { partId: "wheel", frames, rest: 90 };
  },
};

export const machine: MachineModule = {
  kind: "wheel-and-axle",
  scene: wheelAndAxleScene,
};
