import {
  Box,
  Circle,
  DistanceJoint,
  GearJoint,
  PrismaticJoint,
  RevoluteJoint,
  Vec2,
  WeldJoint,
} from "planck";
import type { SettingSpec, SettingValues } from "../../scenes/settings";
import { blockShapes } from "../parts";
import { ForceSampler } from "../sampler";
import type {
  Keyframe,
  Machine,
  MachineModule,
  Part,
  Rope,
  SceneDefinition,
  Script,
  Shape,
  Vec,
} from "../types";

// The screw: an inclined plane wound round a post (docs/research/physics.md,
// "Screw"), built as a screw jack seen from the side. The screw is pinned to
// the page and only turns; a nut carrying the platform rides its thread on a
// vertical guide; a gear joint ties the two so one turn lifts one lead.
// Thread friction is the bearing's motor at zero speed with a torque budget
// that follows the thrust the thread carries, which reproduces the textbook
// efficiency tan λ / tan(λ + φ) and self-locking when μ > tan λ. The "press"
// preset drives the platform up against a spring under a fixed beam instead
// of lifting a weight.

const TAU = 2 * Math.PI;

// Mean thread radius: the shank's half width.
const THREAD_RADIUS = 0.07;
const BASE_Y = -0.9;
const PLATE_HALF_WIDTH = 0.5;
const PLATE_THICKNESS = 0.08;
const PEDESTAL_HEIGHT = 0.17;
const PEDESTAL_HALF_FOOT = 0.22;
const PEDESTAL_HALF_TOP = 0.15;
const SHANK_BOTTOM = BASE_Y + PLATE_THICKNESS + PEDESTAL_HEIGHT;
const HEAD_Y = 0.7;
const HEAD_RADIUS = 0.08;
const SHANK_TOP = HEAD_Y - HEAD_RADIUS;
const BAR_HALF_THICKNESS = 0.025;
const KNOB_RADIUS = 0.035;
const SCREW_DENSITY = 20;

const NUT_HALF_WIDTH = 0.15;
const NUT_HALF_HEIGHT = 0.08;
const TABLE_HALF_WIDTH = 0.36;
const TABLE_THICKNESS = 0.05;
const TABLE_TOP = NUT_HALF_HEIGHT + TABLE_THICKNESS;
const PLATFORM_DENSITY = 9;
// The nut hangs on the thread a little above the pedestal at rest, and the
// guide lets it sink that far when the load unwinds the screw.
const REST_GAP = 0.03;
const PLATFORM_REST_Y = SHANK_BOTTOM + REST_GAP + NUT_HALF_HEIGHT;
const DROP = 0.02;
const MIN_TRAVEL = 0.06;
const MAX_TRAVEL = 0.4;
// The bar's sweep stays this far clear of whatever rides the platform.
const SWEEP_CLEARANCE = 0.12;

const WEIGHT_HALF_WIDTH = 0.24;
const WEIGHT_HALF_HEIGHT = 0.12;

// Press: the spring pushes back with the load's weight per this much
// compression, and may be squeezed to this fraction of its free length.
const PRESS_STROKE = 0.1;
const SPRING_MIN_LENGTH = 0.16;
const SPRING_MIN_FRACTION = 0.4;
const SPRING_HALF_WIDTH = 0.12;
const SPRING_COILS = 8;
const UPRIGHT_X = 0.42;
const UPRIGHT_WIDTH = 0.07;
const BEAM_HALF_WIDTH = 0.54;
const BEAM_THICKNESS = 0.1;

// Drawing only. Light from the upper left: shadow bands sit on undersides
// (hatched at 60), vertical right faces (65), and take a quarter to a third
// of the part's depth, as on the lever plate.
const PLATE_SHADOW = 0.06;
const PEDESTAL_SHADOW = 0.05;
const NUT_SHADOW = 0.045;
const TABLE_SHADOW = 0.018;
const BEAM_SHADOW = 0.03;
const UPRIGHT_SHADOW = 0.02;
// The bar's collar on the head, seen from above.
const COLLAR_RADIUS = 0.045;
// How deep the thread's root cuts into the shank's silhouette, and how many
// segments draw each half-turn of thread.
const THREAD_NOTCH = 0.012;
const THREAD_SEGMENTS = 8;

const EFFORT_THRESHOLD = 0.2;
// Advantage is measured while the screw creeps: between a turn a minute and
// half a turn a second, in radians per second.
const CREEP_MIN = 0.1;
const CREEP_MAX = 3;

// Demonstration: a pause, one and a half turns, then a hold.
const PREROLL = 40;
const TURNS = 1.5;
const TURN_STEPS = 480;
const FRAMES_PER_TURN = 24;
const REST = 150;

interface Layout {
  press: boolean;
  // Handle radius: half the capstan bar.
  radius: number;
  // How far the platform may rise from rest.
  travel: number;
  // Press only: the underside of the fixed beam and the spring's free length.
  spring: { beamY: number; length: number } | null;
}

function layoutFor(
  values: SettingValues,
  variant: string | undefined,
  withLoad: boolean,
): Layout {
  const radius = values.handleRadius ?? 0.6;
  const press = variant === "press";
  const tableTop = PLATFORM_REST_Y + TABLE_TOP;
  const sweepBottom = HEAD_Y - radius - SWEEP_CLEARANCE;
  if (press && withLoad) {
    const beamY = Math.max(
      sweepBottom - BEAM_THICKNESS,
      tableTop + SPRING_MIN_LENGTH,
    );
    const length = beamY - tableTop;
    return {
      press,
      radius,
      travel: length * (1 - SPRING_MIN_FRACTION),
      spring: { beamY, length },
    };
  }
  const top = withLoad ? tableTop + 2 * WEIGHT_HALF_HEIGHT : tableTop;
  const travel = Math.min(MAX_TRAVEL, Math.max(MIN_TRAVEL, sweepBottom - top));
  return { press, radius, travel, spring: null };
}

export const SCREW_SETTINGS: readonly SettingSpec[] = [
  {
    key: "lead",
    label: "Lead",
    min: 0.02,
    max: 0.1,
    step: 0.005,
    defaultValue: 0.05,
    unit: "m",
  },
  {
    key: "handleRadius",
    label: "Handle radius",
    min: 0.3,
    max: 0.9,
    step: 0.05,
    defaultValue: 0.6,
    unit: "m",
  },
  {
    key: "load",
    label: "Load",
    min: 1,
    max: 8,
    step: 0.5,
    defaultValue: 4,
    unit: "kg",
  },
  {
    key: "threadFriction",
    label: "Thread friction",
    min: 0,
    max: 0.5,
    step: 0.05,
    defaultValue: 0.15,
  },
  {
    key: "gravity",
    label: "Gravity",
    min: 1,
    max: 20,
    step: 0.1,
    defaultValue: 9.8,
    unit: "m/s²",
  },
];

function formatNewtons(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} N`;
}

function formatRatio(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0);
}

function corners(x0: number, y0: number, x1: number, y1: number): Vec[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

// An outline; opaque when it stands in front of the thread.
function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opaque = false,
): Shape {
  return {
    kind: "polygon",
    points: corners(x0, y0, x1, y1),
    closed: true,
    opaque,
  };
}

// A shadow band: hatching with no outline of its own.
function shade(points: readonly Vec[], angle: number): Shape {
  return {
    kind: "polygon",
    points,
    closed: true,
    fill: true,
    outline: false,
    hatch: { angle },
  };
}

function band(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  angle: number,
): Shape {
  return shade(corners(x0, y0, x1, y1), angle);
}

// The thread. Turning the screw by dθ looks exactly like sliding the thread
// along the axis by lead · dθ / 2π, so every frame the turns are laid out
// from this shift of the pattern.
function threadShift(angle: number, lead: number): number {
  return ((((angle / TAU) * lead) % lead) + lead) % lead;
}

// The centre height of every turn that could show on the shank.
function turnCentres(shift: number, lead: number): number[] {
  const count = Math.ceil((SHANK_TOP - SHANK_BOTTOM) / lead) + 2;
  const centres: number[] = [];
  for (let i = 0; i < count; i += 1) {
    centres.push(SHANK_BOTTOM - lead + shift + i * lead);
  }
  return centres;
}

const onShank = (y: number) => y >= SHANK_BOTTOM && y <= SHANK_TOP;

// The front half of each turn, seen from the side, is a sine curve climbing
// from the left silhouette to the right and meeting both tangentially; that
// tangency is what makes a helix read as a helix and not as hatching. Each
// curve climbs a whole lead where a true half-turn climbs half of one, the
// engraver's exaggeration that keeps a fine thread reading as a thread.
// Points past either end of the shank are dropped.
function threadStrands(shift: number, lead: number, origin: Vec): Vec[][] {
  const strands: Vec[][] = [];
  for (const centre of turnCentres(shift, lead)) {
    const points: Vec[] = [];
    for (let k = 0; k <= THREAD_SEGMENTS; k += 1) {
      const y = centre - lead / 2 + (lead * k) / THREAD_SEGMENTS;
      if (!onShank(y)) {
        continue;
      }
      const t = -Math.PI / 2 + (Math.PI * k) / THREAD_SEGMENTS;
      points.push({
        x: origin.x + THREAD_RADIUS * Math.sin(t),
        y: origin.y + y,
      });
    }
    if (points.length >= 2) {
      strands.push(points);
    }
  }
  return strands;
}

// The shank's two edges, notched where the thread's root crosses the
// silhouette: a crest where each curve leaves the edge, a root half a lead
// on. Built from the same shift as the thread, so the notches slide with it.
function shankStrands(shift: number, lead: number, origin: Vec): Vec[][] {
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (const centre of turnCentres(shift, lead)) {
    left.push(
      { x: -THREAD_RADIUS, y: centre - lead / 2 },
      { x: -THREAD_RADIUS + THREAD_NOTCH, y: centre },
    );
    right.push(
      { x: THREAD_RADIUS, y: centre + lead / 2 },
      { x: THREAD_RADIUS - THREAD_NOTCH, y: centre + lead },
    );
  }
  const edge = (points: Vec[], x: number): Vec[] =>
    [
      { x, y: SHANK_BOTTOM },
      ...points.filter((p) => onShank(p.y)),
      { x, y: SHANK_TOP },
    ].map((p) => ({ x: origin.x + p.x, y: origin.y + p.y }));
  return [edge(left, -THREAD_RADIUS), edge(right, THREAD_RADIUS)];
}

export const screwScene: SceneDefinition = {
  settings: SCREW_SETTINGS,
  camera: { x: 0, y: -0.42, height: 3.7, width: 2.4 },
  build(world, page, values, variant, context) {
    const lead = values.lead ?? 0.05;
    const loadMass = values.load ?? 4;
    const threadFriction = values.threadFriction ?? 0.15;
    const gravity = values.gravity ?? 9.8;
    const layout = layoutFor(values, variant, context.standalone);
    const { radius } = layout;
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);
    const leadAngle = Math.atan(lead / (TAU * THREAD_RADIUS));

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    // The parts of one jack never touch each other; the bar is a mixed
    // projection (below) and touches nothing at all.
    const group = { filterGroupIndex: -1 };

    const base = world.createBody({ type: "static", position: at(0, BASE_Y) });
    base.createFixture(
      new Box(
        PLATE_HALF_WIDTH,
        PLATE_THICKNESS / 2,
        new Vec2(0, PLATE_THICKNESS / 2),
      ),
      { ...group, friction: 0.5 },
    );

    // The screw only turns; in this side view its axis is vertical, so the
    // capstan bar through its head is drawn in a mixed projection, seen from
    // above while the rest of the jack is seen from the side. The period
    // plates do the same, and it is deliberate: the reader drags the bar's
    // end round the axis in the picture plane.
    const screw = world.createBody({
      type: "dynamic",
      position: at(0, HEAD_Y),
    });
    screw.createFixture(new Box(radius, BAR_HALF_THICKNESS), {
      density: SCREW_DENSITY,
      filterMaskBits: 0,
    });
    screw.createFixture(new Circle(HEAD_RADIUS), {
      density: SCREW_DENSITY,
      filterMaskBits: 0,
    });
    const spin = world.createJoint(
      new RevoluteJoint(
        { enableMotor: true, motorSpeed: 0, maxMotorTorque: 0 },
        page,
        screw,
        at(0, HEAD_Y),
      ),
    );
    if (spin === null) {
      throw new Error("The world refused the screw's bearing");
    }

    const platform = world.createBody({
      type: "dynamic",
      position: at(0, PLATFORM_REST_Y),
    });
    platform.createFixture(new Box(NUT_HALF_WIDTH, NUT_HALF_HEIGHT), {
      ...group,
      density: PLATFORM_DENSITY,
    });
    platform.createFixture(
      new Box(
        TABLE_HALF_WIDTH,
        TABLE_THICKNESS / 2,
        new Vec2(0, NUT_HALF_HEIGHT + TABLE_THICKNESS / 2),
      ),
      { ...group, density: PLATFORM_DENSITY },
    );
    const lift = world.createJoint(
      new PrismaticJoint(
        {
          enableLimit: true,
          lowerTranslation: -DROP,
          upperTranslation: layout.travel,
        },
        page,
        platform,
        at(0, PLATFORM_REST_Y),
        new Vec2(0, 1),
      ),
    );
    if (lift === null) {
      throw new Error("The world refused the platform's guide");
    }
    // angle + ratio · translation stays constant, so one turn lifts one lead
    // and the thread's thrust reaches the screw as torque · 2π / lead.
    const gear = world.createJoint(
      new GearJoint({}, screw, platform, spin, lift, -TAU / lead),
    );
    if (gear === null) {
      throw new Error("The world refused the screw's thread");
    }

    // The chapter's jack lifts a weight welded to the table; its press
    // squeezes a spring against the beam. The Theatre gets the bare jack.
    const weight =
      context.standalone && !layout.press
        ? world.createBody({
            type: "dynamic",
            position: at(0, PLATFORM_REST_Y + TABLE_TOP + WEIGHT_HALF_HEIGHT),
          })
        : null;
    if (weight !== null) {
      weight.createFixture(new Box(WEIGHT_HALF_WIDTH, WEIGHT_HALF_HEIGHT), {
        ...group,
        density: loadMass / (4 * WEIGHT_HALF_WIDTH * WEIGHT_HALF_HEIGHT),
      });
      world.createJoint(
        new WeldJoint({}, platform, weight, at(0, PLATFORM_REST_Y + TABLE_TOP)),
      );
    }
    const spring =
      layout.spring === null
        ? null
        : world.createJoint(
            new DistanceJoint(
              {
                length: layout.spring.length,
                frequencyHz:
                  Math.sqrt(
                    (loadMass * gravity) / PRESS_STROKE / platform.getMass(),
                  ) / TAU,
                dampingRatio: 0.5,
              },
              page,
              platform,
              at(0, layout.spring.beamY),
              at(0, PLATFORM_REST_Y + TABLE_TOP),
            ),
          );
    if (layout.spring !== null && spring === null) {
      throw new Error("The world refused the press's spring");
    }

    // The base plate and its pedestal: outlines, a band on the plate's right
    // end and along the pedestal's right edge, a ground line beneath.
    const pedestalFoot = PLATE_THICKNESS;
    const pedestalTop = PLATE_THICKNESS + PEDESTAL_HEIGHT;
    const baseShapes: Shape[] = [
      rect(-PLATE_HALF_WIDTH, 0, PLATE_HALF_WIDTH, PLATE_THICKNESS),
      band(
        PLATE_HALF_WIDTH - PLATE_SHADOW,
        0,
        PLATE_HALF_WIDTH,
        PLATE_THICKNESS,
        65,
      ),
      {
        kind: "polygon",
        points: [
          { x: -PEDESTAL_HALF_FOOT, y: pedestalFoot },
          { x: PEDESTAL_HALF_FOOT, y: pedestalFoot },
          { x: PEDESTAL_HALF_TOP, y: pedestalTop },
          { x: -PEDESTAL_HALF_TOP, y: pedestalTop },
        ],
        closed: true,
      },
      shade(
        [
          { x: PEDESTAL_HALF_FOOT, y: pedestalFoot },
          { x: PEDESTAL_HALF_TOP, y: pedestalTop },
          { x: PEDESTAL_HALF_TOP - PEDESTAL_SHADOW, y: pedestalTop },
          { x: PEDESTAL_HALF_FOOT - PEDESTAL_SHADOW, y: pedestalFoot },
        ],
        65,
      ),
      {
        kind: "segment",
        from: { x: -PLATE_HALF_WIDTH - 0.15, y: -0.02 },
        to: { x: PLATE_HALF_WIDTH + 0.15, y: -0.02 },
        stroke: "soft",
      },
    ];
    if (layout.spring !== null) {
      // The press frame: two uprights from the base plate carrying the beam
      // the spring bears on. It belongs to the base body rather than to the
      // statics because parts are drawn after ropes and statics before them:
      // only here can the opaque beam hide the thread and the spring's end.
      const beamBottom = layout.spring.beamY - BASE_Y;
      const beamTop = beamBottom + BEAM_THICKNESS;
      for (const side of [-1, 1]) {
        const inner = side * UPRIGHT_X;
        const outer = side * (UPRIGHT_X + UPRIGHT_WIDTH);
        const right = Math.max(inner, outer);
        baseShapes.push(
          rect(inner, pedestalFoot, outer, beamTop),
          band(right - UPRIGHT_SHADOW, pedestalFoot, right, beamTop, 65),
        );
      }
      baseShapes.push(
        rect(-BEAM_HALF_WIDTH, beamBottom, BEAM_HALF_WIDTH, beamTop, true),
        band(
          -BEAM_HALF_WIDTH,
          beamBottom,
          BEAM_HALF_WIDTH,
          beamBottom + BEAM_SHADOW,
          60,
        ),
      );
    }
    const basePart: Part = { id: "base", body: base, shapes: baseShapes };

    // The bar and head seen from above: the bar's turning is the rotation
    // cue, so the head is a plain disc with the bar's collar on it.
    const screwPart: Part = {
      id: "screw",
      body: screw,
      shapes: [
        rect(-radius, -BAR_HALF_THICKNESS, radius, BAR_HALF_THICKNESS),
        { kind: "circle", center: { x: 0, y: 0 }, radius: HEAD_RADIUS },
        {
          kind: "circle",
          center: { x: 0, y: 0 },
          radius: COLLAR_RADIUS,
          stroke: "soft",
        },
        {
          kind: "circle",
          center: { x: -radius, y: 0 },
          radius: KNOB_RADIUS,
          stroke: "soft",
        },
        {
          kind: "circle",
          center: { x: radius, y: 0 },
          radius: KNOB_RADIUS,
          stroke: "soft",
        },
      ],
      grab: { hintAt: { x: radius, y: 0 } },
    };
    // The nut and its table as one opaque solid in front of the thread, a
    // band on the nut's right face and under each wing of the table.
    const platformPart: Part = {
      id: "platform",
      body: platform,
      shapes: [
        {
          kind: "polygon",
          points: [
            { x: -NUT_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: NUT_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: NUT_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: TABLE_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: TABLE_HALF_WIDTH, y: TABLE_TOP },
            { x: -TABLE_HALF_WIDTH, y: TABLE_TOP },
            { x: -TABLE_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: -NUT_HALF_WIDTH, y: NUT_HALF_HEIGHT },
          ],
          closed: true,
          opaque: true,
        },
        band(
          NUT_HALF_WIDTH - NUT_SHADOW,
          -NUT_HALF_HEIGHT,
          NUT_HALF_WIDTH,
          NUT_HALF_HEIGHT,
          65,
        ),
        band(
          -TABLE_HALF_WIDTH,
          NUT_HALF_HEIGHT,
          -NUT_HALF_WIDTH,
          NUT_HALF_HEIGHT + TABLE_SHADOW,
          60,
        ),
        band(
          NUT_HALF_WIDTH,
          NUT_HALF_HEIGHT,
          TABLE_HALF_WIDTH,
          NUT_HALF_HEIGHT + TABLE_SHADOW,
          60,
        ),
      ],
    };
    // The book's block, without its ring: nothing hangs it, the table
    // carries it, and the shank rises through it out of sight.
    const weightPart: Part | null =
      weight === null
        ? null
        : {
            id: "weight",
            body: weight,
            shapes: blockShapes({
              halfWidth: WEIGHT_HALF_WIDTH,
              halfHeight: WEIGHT_HALF_HEIGHT,
              ring: false,
            }),
          };

    // The axis, for the technical themes.
    const statics: Shape[] = [
      {
        kind: "segment",
        from: { x: origin.x, y: origin.y + BASE_Y - 0.05 },
        to: { x: origin.x, y: origin.y + HEAD_Y + HEAD_RADIUS + 0.05 },
        stroke: "faint",
        dash: "center",
      },
    ];

    // The shank and its thread are ropes, not statics: their notches and
    // curves slide with the screw's angle every frame.
    const ropes: Rope[] = [
      {
        id: "shank",
        stroke: "ink",
        strands: () =>
          shankStrands(threadShift(screw.getAngle(), lead), lead, origin),
      },
      {
        id: "thread",
        stroke: "soft",
        strands: () =>
          threadStrands(threadShift(screw.getAngle(), lead), lead, origin),
      },
    ];
    if (layout.spring !== null) {
      // A coil spring on the shank between the table and the beam, drawn as
      // a zigzag that shortens as the press squeezes it.
      const top = origin.y + layout.spring.beamY;
      const zigs = SPRING_COILS * 2;
      ropes.push({
        id: "spring",
        stroke: "soft",
        strands: () => {
          const foot = platform.getWorldPoint(new Vec2(0, TABLE_TOP));
          const points: Vec[] = [{ x: foot.x, y: foot.y }];
          for (let i = 1; i < zigs; i += 1) {
            points.push({
              x:
                origin.x +
                (i % 2 === 1 ? SPRING_HALF_WIDTH : -SPRING_HALF_WIDTH),
              y: foot.y + ((top - foot.y) * i) / zigs,
            });
          }
          points.push({ x: origin.x, y: top });
          return [points];
        },
      });
    }

    const effortSampler = new ForceSampler();
    let effortNow = 0;
    let pressForce = 0;
    let compression = 0;

    const loadForce = (): number =>
      layout.press ? pressForce : (weight?.getMass() ?? 0) * gravity;

    const parts: Part[] = [basePart, screwPart, platformPart];
    if (weightPart !== null) {
      parts.push(weightPart);
    }

    const machine: Machine = {
      parts,
      ropes,
      statics,
      ports: [
        {
          id: "bar-end",
          kind: "handle",
          part: "screw",
          at: { x: radius, y: 0 },
          role: "effort",
        },
        {
          id: "platform",
          kind: "pin",
          part: "platform",
          at: { x: 0, y: TABLE_TOP },
          role: "load",
        },
        {
          id: "base",
          kind: "face",
          part: "base",
          at: { x: 0, y: 0 },
          role: "either",
        },
      ],
      step(context) {
        const inverseDt = 1 / context.dt;
        // Coulomb friction on the thread grows with the thrust it carries.
        // The gear joint is what carries it (the guide only takes side load
        // and the stops), and it reports the thrust as the torque it puts on
        // the screw. Before the first solve the joint has no Jacobian and
        // reports nothing usable, so the thread starts unloaded.
        const thrust =
          context.step === 0
            ? 0
            : Math.abs(gear.getReactionTorque(inverseDt)) * (TAU / lead);
        if (!Number.isFinite(thrust)) {
          throw new Error("The thread's thrust is not finite");
        }
        spin.setMaxMotorTorque(threadFriction * thrust * THREAD_RADIUS);
        if (spring !== null && context.step > 0) {
          pressForce = spring.getReactionForce(inverseDt).length();
          compression =
            spring.getLength() -
            Vec2.distance(spring.getAnchorA(), spring.getAnchorB());
        }
        if (context.handPart === screwPart && context.handIsReader) {
          // Effort is the part of the hand's force that turns the bar, taken
          // at the bar's end where the hand holds it.
          const along = screw.getWorldVector(new Vec2(1, 0));
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
        const ideal = (TAU * radius) / lead;
        const load = loadForce();
        const readouts = [
          {
            label: layout.press ? "Press" : "Load",
            value: formatNewtons(load),
          },
          { label: "Ideal advantage", value: formatRatio(ideal) },
          {
            label: "Self-locking",
            value: threadFriction > Math.tan(leadAngle) ? "yes" : "no",
          },
        ];
        if (layout.press) {
          readouts.push({
            label: "Compression",
            value: `${Math.max(0, compression * 1000).toFixed(0)} mm`,
          });
        }
        if (effortNow > EFFORT_THRESHOLD) {
          // Advantage is quasi-static, and on a screw it is only measurable
          // while the nut creeps up: a locked thread lets the hand lean on
          // the bar with any force short of what would move it.
          const rate = screw.getAngularVelocity();
          const creeping = rate > CREEP_MIN && rate < CREEP_MAX;
          const measured = load / effortNow;
          let advantage = "moving";
          if (creeping) {
            advantage = formatRatio(measured);
          } else if (Math.abs(rate) < CREEP_MIN) {
            advantage = "holding";
          }
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          readouts.push({ label: "Advantage", value: advantage });
          if (creeping) {
            readouts.push({
              label: "Efficiency",
              value: `${((100 * measured) / ideal).toFixed(0)}%`,
            });
          }
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const { radius } = layoutFor(values, variant, true);
    return { partId: "screw", at: { x: radius, y: HEAD_Y } };
  },
  script(values, variant): Script {
    const { radius } = layoutFor(values, variant, true);
    const segments = TURNS * FRAMES_PER_TURN;
    const frames: Keyframe[] = [
      { step: 0, x: radius, y: HEAD_Y },
      { step: PREROLL, x: radius, y: HEAD_Y },
    ];
    for (let k = 1; k <= segments; k += 1) {
      const angle = (TAU * TURNS * k) / segments;
      frames.push({
        step: PREROLL + Math.round((TURN_STEPS * k) / segments),
        x: radius * Math.cos(angle),
        y: HEAD_Y + radius * Math.sin(angle),
      });
    }
    // Hold, let go so the jack shows whether it locks or unwinds, then rest.
    return {
      partId: "screw",
      frames,
      release: PREROLL + TURN_STEPS + REST,
      rest: REST + 120,
    };
  },
};

export const machine: MachineModule = { kind: "screw", scene: screwScene };
