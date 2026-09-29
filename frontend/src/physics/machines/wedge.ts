import {
  Box,
  DistanceJoint,
  type Joint,
  Polygon,
  PrismaticJoint,
  Settings,
  Vec2,
} from "planck";
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

// The wedge: a triangle driven down between two blocks that may only slide
// apart (docs/research/physics.md, "Wedge"). The force is carried by contact
// on the faces, so friction there is real and the wedge self-locks when the
// friction coefficient exceeds the tangent of the half angle. The blocks ride
// horizontal guides on the page; a Coulomb motor on each guide and a spring
// between them stand in for the grip and elasticity of the log being split.

const BLOCK_WIDTH = 1;
const BLOCK_HEIGHT = 1;
const BLOCK_MASS = 2.4;
// The blocks stand high enough that the base line clears a titled caption.
const BLOCK_TOP = 0.5;
const WEDGE_LENGTH = 1.1;
const WEDGE_MASS = 0.3;
// A wedge's weight is nothing beside the blow that drives it. At this scene's
// scale (tens of newtons of resistance) a full-weight wedge would hold itself
// in and hide the self-locking threshold, so it weighs a tenth of its mass.
const WEDGE_GRAVITY_SCALE = 0.1;
// How far the tip sits below the blocks' top when the wedge is seated.
const SEAT_DEPTH = 0.18;
// The guide stops the tip this far above the blocks' bottom.
const TRAVEL_MARGIN = 0.12;
// The wedge may be squeezed up until the tip is this far into the blocks.
const MIN_DEPTH = 0.05;
const SLIDE_LIMIT = 1.2;
// Spring stiffness in newtons per metre of spread, per newton of resistance.
const SPRING_PER_RESISTANCE = 2;
const SPRING_DAMPING = 0.5;
// Two polygons rest with their skins overlapping by the slop, so the blocks
// are seated that much clear of the wedge's faces or the still page settles.
const SKIN = 2 * Settings.polygonRadius - Settings.linearSlop;
const DRIVE = 0.6;
const BASE_HALF = 1.7;

const DEFAULT_ANGLE = 20;
const DEFAULT_FRICTION = 0.2;
const DEFAULT_RESISTANCE = 20;
const DEFAULT_GRAVITY = 9.8;

interface Layout {
  halfAngle: number;
  headHalfWidth: number;
  // Half the initial gap between the blocks' inner faces.
  halfGap: number;
  tipY: number;
  blockX: number;
  blockY: number;
  log: boolean;
}

function layoutFor(values: SettingValues, variant: string | undefined): Layout {
  const angle = values.wedgeAngle ?? DEFAULT_ANGLE;
  const halfAngle = (angle / 2) * (Math.PI / 180);
  const halfGap = SEAT_DEPTH * Math.tan(halfAngle) + SKIN / Math.cos(halfAngle);
  return {
    halfAngle,
    headHalfWidth: WEDGE_LENGTH * Math.tan(halfAngle),
    halfGap,
    tipY: BLOCK_TOP - SEAT_DEPTH,
    blockX: halfGap + BLOCK_WIDTH / 2,
    blockY: BLOCK_TOP - BLOCK_HEIGHT / 2,
    log: variant === "log",
  };
}

export const WEDGE_SETTINGS: readonly SettingSpec[] = [
  {
    key: "wedgeAngle",
    label: "Wedge angle",
    min: 10,
    max: 40,
    step: 1,
    defaultValue: DEFAULT_ANGLE,
    unit: "°",
  },
  {
    key: "friction",
    label: "Friction",
    min: 0,
    max: 0.8,
    step: 0.05,
    defaultValue: DEFAULT_FRICTION,
  },
  {
    key: "resistance",
    label: "Resistance",
    min: 5,
    max: 60,
    step: 1,
    defaultValue: DEFAULT_RESISTANCE,
    unit: "N",
  },
  {
    key: "gravity",
    label: "Gravity",
    min: 1,
    max: 20,
    step: 0.5,
    defaultValue: DEFAULT_GRAVITY,
    unit: "m/s²",
  },
];

function formatNewtons(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} N`;
}

function joined<T extends Joint>(joint: T | null, what: string): T {
  if (joint === null) {
    throw new Error(`The world refused the wedge's ${what}`);
  }
  return joint;
}

function rectangle(halfWidth: number, halfHeight: number): Shape {
  return {
    kind: "polygon",
    points: [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ],
    closed: true,
    fill: true,
  };
}

// The end grain of a standing log, seen a little from above: half an ellipse
// centred on the split. `fraction` scales it for the growth rings; the sweep
// runs from the front of the split (-π/2) over the bark (0) to the back (π/2).
function endGrain(
  side: -1 | 1,
  fraction: number,
  from: number,
  to: number,
): Vec[] {
  const inner = -side * (BLOCK_WIDTH / 2);
  const radius = BLOCK_WIDTH * fraction;
  const depth = 0.1 * fraction;
  const steps = 10;
  const points: Vec[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const phi = from + ((to - from) * i) / steps;
    points.push({
      x: inner + side * radius * Math.cos(phi),
      y: BLOCK_HEIGHT / 2 + depth * Math.sin(phi),
    });
  }
  return points;
}

const BARK_BUMPS = [0.02, 0.008, 0.028, 0.012, 0.024, 0.006];

// Half a split log: bark on the outer edge, the split face inward, the end
// grain on top with its rings.
function logShapes(side: -1 | 1): Shape[] {
  const w = BLOCK_WIDTH / 2;
  const h = BLOCK_HEIGHT / 2;
  const inner = -side * w;
  const outer = side * w;
  const bark: Vec[] = BARK_BUMPS.map((bump, i) => ({
    x: outer + side * bump,
    y: -h + ((i + 1) * 2 * h) / (BARK_BUMPS.length + 1),
  }));
  const frontRim = endGrain(side, 1, 0, -Math.PI / 2);
  const body: Shape = {
    kind: "polygon",
    points: [{ x: inner, y: -h }, { x: outer, y: -h }, ...bark, ...frontRim],
    closed: true,
    fill: true,
  };
  const backRim: Shape = {
    kind: "polygon",
    points: [...endGrain(side, 1, 0, Math.PI / 2), { x: inner, y: h - 0.1 }],
    closed: false,
  };
  const rings: Shape[] = [0.66, 0.38, 0.14].map((fraction) => ({
    kind: "polygon",
    points: endGrain(side, fraction, -Math.PI / 2, Math.PI / 2),
    closed: false,
    stroke: "soft",
  }));
  return [body, backRim, ...rings];
}

function wedgeShapes(headHalfWidth: number, iron: boolean): Shape[] {
  const blade: Shape = {
    kind: "polygon",
    points: [
      { x: 0, y: 0 },
      { x: headHalfWidth, y: WEDGE_LENGTH },
      { x: -headHalfWidth, y: WEDGE_LENGTH },
    ],
    closed: true,
    fill: true,
  };
  if (!iron) {
    // A band below the head, where the mallet has hardened it.
    const band: Shape = {
      kind: "segment",
      from: { x: -headHalfWidth * 0.95, y: WEDGE_LENGTH - 0.06 },
      to: { x: headHalfWidth * 0.95, y: WEDGE_LENGTH - 0.06 },
      stroke: "soft",
    };
    return [blade, band];
  }
  // An iron wedge's head mushrooms under the sledge: it spreads past the
  // blade and curls over.
  const w = headHalfWidth;
  const L = WEDGE_LENGTH;
  const over = 0.05;
  const cap: Shape = {
    kind: "polygon",
    points: [
      { x: -w, y: L },
      { x: -w - over, y: L + 0.015 },
      { x: -w - over - 0.01, y: L + 0.06 },
      { x: -w - over + 0.01, y: L + 0.095 },
      { x: -w * 0.6, y: L + 0.12 },
      { x: 0, y: L + 0.13 },
      { x: w * 0.6, y: L + 0.12 },
      { x: w + over - 0.01, y: L + 0.095 },
      { x: w + over + 0.01, y: L + 0.06 },
      { x: w + over, y: L + 0.015 },
      { x: w, y: L },
    ],
    closed: true,
    fill: true,
  };
  return [blade, cap];
}

export const wedgeScene: SceneDefinition = {
  settings: WEDGE_SETTINGS,
  camera: { x: 0, y: -0.2, height: 4, width: 4.6 },
  build(world, page, values, variant, context) {
    const friction = values.friction ?? DEFAULT_FRICTION;
    const resistance = values.resistance ?? DEFAULT_RESISTANCE;
    const gravity = values.gravity ?? DEFAULT_GRAVITY;
    const layout = layoutFor(values, variant);
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    // Each block resists with half the setting as guide friction and half as
    // the spring's pull at rest, so it resists with exactly the setting
    // before the wedge has parted them; the spring then stiffens the log as
    // the split opens.
    const guideFriction = resistance / 2;
    const springStiffness = SPRING_PER_RESISTANCE * resistance;
    const springPretension = resistance / 2;

    const makeBlock = (side: -1 | 1) => {
      const position = at(side * layout.blockX, layout.blockY);
      const body = world.createBody({ type: "dynamic", position });
      body.createFixture(new Box(BLOCK_WIDTH / 2, BLOCK_HEIGHT / 2), {
        density: BLOCK_MASS / (BLOCK_WIDTH * BLOCK_HEIGHT),
        friction,
      });
      // The guide is the page: a horizontal slide whose motor, held at zero
      // speed, is Coulomb friction. The limits keep the blocks on the page and
      // off each other.
      joined(
        world.createJoint(
          new PrismaticJoint(
            {
              enableMotor: true,
              motorSpeed: 0,
              maxMotorForce: guideFriction,
              enableLimit: true,
              lowerTranslation: side < 0 ? -SLIDE_LIMIT : -layout.halfGap,
              upperTranslation: side < 0 ? layout.halfGap : SLIDE_LIMIT,
            },
            page,
            body,
            position,
            new Vec2(1, 0),
          ),
        ),
        "block guide",
      );
      return body;
    };
    const left = makeBlock(-1);
    const right = makeBlock(1);
    const initialSeparation = 2 * layout.blockX;

    // The chapter's log fights back: a soft spring between the blocks, pulled
    // taut by the pretension. The Theatre leaves the faces free for whatever
    // is set against them. Planck's spring is set by frequency, so the
    // stiffness is converted through the blocks' reduced mass.
    const reducedMass = BLOCK_MASS / 2;
    const spring = context.standalone
      ? joined(
          world.createJoint(
            new DistanceJoint(
              {
                frequencyHz:
                  Math.sqrt(springStiffness / reducedMass) / (2 * Math.PI),
                dampingRatio: SPRING_DAMPING,
                length: initialSeparation - springPretension / springStiffness,
                collideConnected: true,
              },
              left,
              right,
              left.getPosition(),
              right.getPosition(),
            ),
          ),
          "spring",
        )
      : null;

    const wedge = world.createBody({
      type: "dynamic",
      position: at(0, layout.tipY),
      bullet: true,
      gravityScale: WEDGE_GRAVITY_SCALE,
    });
    const hw = layout.headHalfWidth;
    wedge.createFixture(
      new Polygon([
        new Vec2(0, 0),
        new Vec2(hw, WEDGE_LENGTH),
        new Vec2(-hw, WEDGE_LENGTH),
      ]),
      { density: WEDGE_MASS / (hw * WEDGE_LENGTH), friction },
    );
    joined(
      world.createJoint(
        new PrismaticJoint(
          {
            enableLimit: true,
            lowerTranslation: -(BLOCK_HEIGHT - SEAT_DEPTH - TRAVEL_MARGIN),
            upperTranslation: SEAT_DEPTH - MIN_DEPTH,
          },
          page,
          wedge,
          at(0, layout.tipY),
          new Vec2(0, 1),
        ),
      ),
      "guide",
    );

    const leftPart: Part = {
      id: "left-block",
      body: left,
      shapes: layout.log
        ? logShapes(-1)
        : [rectangle(BLOCK_WIDTH / 2, BLOCK_HEIGHT / 2)],
    };
    const rightPart: Part = {
      id: "right-block",
      body: right,
      shapes: layout.log
        ? logShapes(1)
        : [rectangle(BLOCK_WIDTH / 2, BLOCK_HEIGHT / 2)],
    };
    const wedgePart: Part = {
      id: "wedge",
      body: wedge,
      shapes: wedgeShapes(hw, layout.log),
      grab: { hintAt: { x: 0, y: WEDGE_LENGTH - 0.08 } },
    };

    const baseY = BLOCK_TOP - BLOCK_HEIGHT - 0.06;
    const baseLine: Shape = {
      kind: "segment",
      from: at(-BASE_HALF, baseY),
      to: at(BASE_HALF, baseY),
      stroke: "soft",
    };

    const effortSampler = new ForceSampler();
    let effortNow = 0;
    const tanHalf = Math.tan(layout.halfAngle);

    const machine: Machine = {
      parts: [leftPart, rightPart, wedgePart],
      ropes: [],
      statics: [baseLine],
      ports: [
        {
          id: "head",
          kind: "handle",
          part: "wedge",
          at: { x: 0, y: WEDGE_LENGTH },
          role: "effort",
        },
        {
          id: "left-face",
          kind: "face",
          part: "left-block",
          at: { x: -BLOCK_WIDTH / 2, y: 0 },
          role: "load",
        },
        {
          id: "right-face",
          kind: "face",
          part: "right-block",
          at: { x: BLOCK_WIDTH / 2, y: 0 },
          role: "load",
        },
      ],
      step(context) {
        if (context.handPart === wedgePart) {
          // Effort is the blow along the wedge: the downward part of the
          // hand's force. Lifting it out is not effort.
          effortSampler.push(Math.max(0, -context.handForce.y));
          effortNow = effortSampler.mean();
        } else {
          effortSampler.clear();
          effortNow = 0;
        }
      },
      readouts() {
        const ideal = 1 / (2 * tanHalf);
        const depth = layout.tipY - (wedge.getPosition().y - origin.y);
        const spread =
          right.getPosition().x - left.getPosition().x - initialSeparation;
        // What each block resists with now: the guide's grip plus the
        // spring's pull, which is its stiffness times its stretch and grows
        // as the split opens.
        const springForce =
          spring === null
            ? 0
            : Math.max(0, springPretension + springStiffness * spread);
        const load = guideFriction + springForce;
        const speed = wedge.getLinearVelocity().y;
        const readouts = [
          { label: "Resistance", value: formatNewtons(load) },
          { label: "Ideal advantage", value: ideal.toFixed(1) },
          { label: "Self-locking", value: friction > tanHalf ? "yes" : "no" },
        ];
        if (depth > 0.005) {
          readouts.push({
            label: "Spread",
            value: `${Math.round(spread * 100)} cm for ${Math.round(depth * 100)} cm in`,
          });
        }
        if (effortNow > 0.5) {
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          // The ratio means something only while the wedge creeps: pushed but
          // still, the effort is short of what moves it; fast, inertia lies.
          let advantage: string;
          if (Math.abs(speed) <= 0.02) {
            advantage = "holding";
          } else if (speed < 0 && speed > -0.5) {
            advantage = (load / effortNow).toFixed(1);
          } else {
            advantage = "moving";
          }
          readouts.push({ label: "Advantage", value: advantage });
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const layout = layoutFor(values, variant);
    return {
      partId: "wedge",
      at: { x: 0, y: layout.tipY + WEDGE_LENGTH },
    };
  },
  script(values, variant): Script {
    const layout = layoutFor(values, variant);
    const head = layout.tipY + WEDGE_LENGTH;
    // The hand's joint is a spring, so its target leads the head by the
    // effort over the joint's stiffness; a tenth of a metre covers the
    // default settings.
    const down = head - DRIVE - 0.1;
    return {
      partId: "wedge",
      // Drive, hold, then let go: a self-locking wedge stays, any other is
      // squeezed back out, and the scene rests before it replays.
      frames: [
        { step: 0, x: 0, y: head },
        { step: 30, x: 0, y: head },
        { step: 330, x: 0, y: down },
        { step: 450, x: 0, y: down },
      ],
      release: 450,
      rest: 210,
    };
  },
};

export const machine: MachineModule = { kind: "wedge", scene: wedgeScene };
