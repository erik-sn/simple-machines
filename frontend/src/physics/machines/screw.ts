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
// Half width of the bore the shank passes through in the nut, the table and
// the weight; a little wider than the shank so the lines stay apart.
const BORE_HALF_WIDTH = 0.08;
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
const BEAM_BORE_HALF_WIDTH = 0.1;

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
    min: 0.01,
    max: 0.1,
    step: 0.005,
    defaultValue: 0.03,
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

function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: boolean,
): Shape {
  return {
    kind: "polygon",
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    closed: true,
    fill,
  };
}

function bridge(y: number, halfWidth: number, dx = 0, dy = 0): Shape {
  return {
    kind: "segment",
    from: { x: dx - halfWidth, y: dy + y },
    to: { x: dx + halfWidth, y: dy + y },
    stroke: "soft",
  };
}

// A block the shank passes through, drawn in half section: hatched cheeks
// either side of the bore and the bore's far wall between them, as the
// period plates draw a nut cut open on its screw.
function bored(x0: number, y0: number, x1: number, y1: number): Shape[] {
  return [
    rect(x0, y0, -BORE_HALF_WIDTH, y1, true),
    rect(BORE_HALF_WIDTH, y0, x1, y1, true),
    bridge(y0, BORE_HALF_WIDTH),
    bridge(y1, BORE_HALF_WIDTH),
  ];
}

// The thread as a barber pole. A right-hand helix seen from the side is a
// row of slanted lines one lead apart, and turning the screw by dθ looks
// exactly like sliding them along the axis by lead · dθ / 2π. The front half
// of each turn climbs half a lead while crossing the shank; the lines are
// drawn climbing a whole lead, the engraver's exaggeration that keeps a fine
// thread reading as a thread. A line running off either end of the shank is
// cut where it leaves.
function threadStrands(angle: number, lead: number, origin: Vec): Vec[][] {
  const halfRise = lead / 2;
  const shift = ((((angle / TAU) * lead) % lead) + lead) % lead;
  const count = Math.ceil((SHANK_TOP - SHANK_BOTTOM) / lead) + 2;
  const strands: Vec[][] = [];
  for (let i = 0; i < count; i += 1) {
    const centre = SHANK_BOTTOM - lead + shift + i * lead;
    const ya = centre - halfRise;
    const yb = centre + halfRise;
    const lo = Math.max(ya, SHANK_BOTTOM);
    const hi = Math.min(yb, SHANK_TOP);
    if (lo >= hi) {
      continue;
    }
    const xAt = (y: number) =>
      -THREAD_RADIUS + ((y - ya) / (yb - ya)) * 2 * THREAD_RADIUS;
    strands.push([
      { x: origin.x + xAt(lo), y: origin.y + lo },
      { x: origin.x + xAt(hi), y: origin.y + hi },
    ]);
  }
  return strands;
}

export const screwScene: SceneDefinition = {
  settings: SCREW_SETTINGS,
  camera: { x: 0, y: -0.42, height: 3.7, width: 2.4 },
  build(world, page, values, variant, context) {
    const lead = values.lead ?? 0.03;
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

    const basePart: Part = {
      id: "base",
      body: base,
      shapes: [
        rect(-PLATE_HALF_WIDTH, 0, PLATE_HALF_WIDTH, PLATE_THICKNESS, true),
        {
          kind: "polygon",
          points: [
            { x: -PEDESTAL_HALF_FOOT, y: PLATE_THICKNESS },
            { x: PEDESTAL_HALF_FOOT, y: PLATE_THICKNESS },
            { x: PEDESTAL_HALF_TOP, y: PLATE_THICKNESS + PEDESTAL_HEIGHT },
            { x: -PEDESTAL_HALF_TOP, y: PLATE_THICKNESS + PEDESTAL_HEIGHT },
          ],
          closed: true,
          fill: true,
        },
        {
          kind: "segment",
          from: { x: -PLATE_HALF_WIDTH - 0.15, y: -0.02 },
          to: { x: PLATE_HALF_WIDTH + 0.15, y: -0.02 },
          stroke: "soft",
        },
      ],
    };
    const screwPart: Part = {
      id: "screw",
      body: screw,
      shapes: [
        rect(-radius, -BAR_HALF_THICKNESS, radius, BAR_HALF_THICKNESS, false),
        // The head, hatched so its turning shows.
        {
          kind: "circle",
          center: { x: 0, y: 0 },
          radius: HEAD_RADIUS,
          fill: true,
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
    // The nut and its table, cut open on the shank like the weight.
    const platformPart: Part = {
      id: "platform",
      body: platform,
      shapes: [
        {
          kind: "polygon",
          points: [
            { x: -BORE_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: -NUT_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: -NUT_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: -TABLE_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: -TABLE_HALF_WIDTH, y: TABLE_TOP },
            { x: -BORE_HALF_WIDTH, y: TABLE_TOP },
          ],
          closed: true,
          fill: true,
        },
        {
          kind: "polygon",
          points: [
            { x: BORE_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: NUT_HALF_WIDTH, y: -NUT_HALF_HEIGHT },
            { x: NUT_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: TABLE_HALF_WIDTH, y: NUT_HALF_HEIGHT },
            { x: TABLE_HALF_WIDTH, y: TABLE_TOP },
            { x: BORE_HALF_WIDTH, y: TABLE_TOP },
          ],
          closed: true,
          fill: true,
        },
        bridge(-NUT_HALF_HEIGHT, BORE_HALF_WIDTH),
        bridge(TABLE_TOP, BORE_HALF_WIDTH),
      ],
    };
    const weightPart: Part | null =
      weight === null
        ? null
        : {
            id: "weight",
            body: weight,
            shapes: bored(
              -WEIGHT_HALF_WIDTH,
              -WEIGHT_HALF_HEIGHT,
              WEIGHT_HALF_WIDTH,
              WEIGHT_HALF_HEIGHT,
            ),
          };

    const statics: Shape[] = [
      {
        kind: "segment",
        from: { x: origin.x - THREAD_RADIUS, y: origin.y + SHANK_BOTTOM },
        to: { x: origin.x - THREAD_RADIUS, y: origin.y + SHANK_TOP },
      },
      {
        kind: "segment",
        from: { x: origin.x + THREAD_RADIUS, y: origin.y + SHANK_BOTTOM },
        to: { x: origin.x + THREAD_RADIUS, y: origin.y + SHANK_TOP },
      },
    ];
    if (layout.spring !== null) {
      // The press frame: two uprights from the base plate carrying the beam
      // the spring bears on, the beam cut open where the shank passes.
      const { beamY } = layout.spring;
      const footY = origin.y + BASE_Y + PLATE_THICKNESS;
      const beamTop = origin.y + beamY + BEAM_THICKNESS;
      for (const side of [-1, 1]) {
        const inner = origin.x + side * UPRIGHT_X;
        const outer = origin.x + side * (UPRIGHT_X + UPRIGHT_WIDTH);
        statics.push(rect(inner, footY, outer, beamTop, false));
      }
      statics.push(
        rect(
          origin.x - BEAM_HALF_WIDTH,
          origin.y + beamY,
          origin.x - BEAM_BORE_HALF_WIDTH,
          beamTop,
          true,
        ),
        rect(
          origin.x + BEAM_BORE_HALF_WIDTH,
          origin.y + beamY,
          origin.x + BEAM_HALF_WIDTH,
          beamTop,
          true,
        ),
        bridge(beamY, BEAM_BORE_HALF_WIDTH, origin.x, origin.y),
        bridge(
          beamY + BEAM_THICKNESS,
          BEAM_BORE_HALF_WIDTH,
          origin.x,
          origin.y,
        ),
      );
    }

    const ropes: Rope[] = [
      {
        id: "thread",
        stroke: "soft",
        strands: () => threadStrands(screw.getAngle(), lead, origin),
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
