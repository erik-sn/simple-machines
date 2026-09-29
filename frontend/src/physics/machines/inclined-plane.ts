import { Box, Circle, Polygon, Vec2 } from "planck";
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

// The inclined plane: a static ramp and a block the hand pushes up it
// (docs/research/physics.md, "Inclined plane"). The slope keeps a fixed run,
// so a gentle ramp is long and low; once the rise reaches what the camera
// fits, a steeper ramp shortens its run instead. Ramp and block carry the
// same friction coefficient, so the contact's is exactly the slider's value
// (Planck mixes fixture friction as a geometric mean). The effort is the
// hand's force along the slope.

const RUN = 3;
const RISE_MAX = 1.8;
const LANDING = 0.5;
const BASE_Y = -0.62;
const BLOCK_HALF: Vec = { x: 0.24, y: 0.15 };
// The stop at the foot is as tall as the block, so a fast slide lands face
// to face and cannot pitch the block over it.
const STOP_HALF: Vec = { x: 0.05, y: 0.15 };
const STOP_ALONG = 0.06;
const WALL_HALF: Vec = { x: 0.05, y: 0.16 };
// Polygon skins and linear slop leave resting bodies about this far apart;
// bodies are placed at rest and the block is drawn down to the surface.
const REST_GAP = 0.015;
const COURSE_SPACING = 0.14;
const WHEEL_RADIUS = 0.11;
const WHEEL_OFFSET = 0.125;
const WHEEL_SIDES = 24;
const PUSHER_RADIUS = 0.05;
const PUSH_DISTANCE = 1.2;
// Below this speed a push is quasi-static, so the force balance is exact and
// the measured advantage means something. At rest, static friction takes an
// indeterminate share of the weight and the hand's force says nothing about
// the ramp, so the advantage is only measured while the block climbs.
const QUASI_STATIC_SPEED = 0.5;
const CLIMB_SPEED = 0.02;
const RAMP_BITS = 0x1;
const BLOCK_BITS = 0x2;
const PUSHER_BITS = 0x4;
// The block's centre, along the slope, when it rests against the stop.
const FOOT_REST = STOP_ALONG + STOP_HALF.x + REST_GAP + BLOCK_HALF.x;

interface Layout {
  angle: number;
  rise: number;
  length: number;
  foot: Vec;
  top: Vec;
  end: Vec;
  // Unit vectors up the slope and out of its surface.
  along: Vec;
  normal: Vec;
  // Where the block starts, along the slope from the foot.
  start: number;
  cart: boolean;
}

function layoutFor(values: SettingValues, variant: string | undefined): Layout {
  const angle = ((values.angle ?? 30) * Math.PI) / 180;
  const rise = Math.min(RUN * Math.tan(angle), RISE_MAX);
  const run = rise / Math.tan(angle);
  const length = Math.hypot(run, rise);
  const foot = { x: -(run + LANDING) / 2, y: BASE_Y };
  const top = { x: foot.x + run, y: BASE_Y + rise };
  return {
    angle,
    rise,
    length,
    foot,
    top,
    end: { x: top.x + LANDING, y: top.y },
    along: { x: Math.cos(angle), y: Math.sin(angle) },
    normal: { x: -Math.sin(angle), y: Math.cos(angle) },
    start: length / 3,
    cart: variant === "cart",
  };
}

// A point `s` metres up the slope from its foot and `n` metres out from it.
function onSlope(layout: Layout, s: number, n: number): Vec {
  return {
    x: layout.foot.x + layout.along.x * s + layout.normal.x * n,
    y: layout.foot.y + layout.along.y * s + layout.normal.y * n,
  };
}

function blockCentre(layout: Layout, s: number): Vec {
  return onSlope(layout, s, BLOCK_HALF.y + REST_GAP);
}

// The pusher parks against the block's lower face, level with its centre so
// the push passes through it and cannot tip the block.
function pusherPark(layout: Layout): Vec {
  return onSlope(
    layout,
    layout.start - BLOCK_HALF.x - REST_GAP - PUSHER_RADIUS,
    BLOCK_HALF.y + REST_GAP,
  );
}

// Stops short of the top edge so the block stays on the slope.
function pushDistance(layout: Layout): number {
  return Math.min(
    PUSH_DISTANCE,
    layout.length - layout.start - BLOCK_HALF.x - 0.1,
  );
}

// Horizontal courses through the wedge, the fill of a built ramp, drawn
// faint so the block reads as the actor.
function courseLines(layout: Layout): Shape[] {
  const shapes: Shape[] = [];
  for (
    let y = BASE_Y + COURSE_SPACING;
    y < layout.top.y - COURSE_SPACING / 3;
    y += COURSE_SPACING
  ) {
    const x = layout.foot.x + (y - BASE_Y) / Math.tan(layout.angle);
    shapes.push({
      kind: "segment",
      from: { x, y },
      to: { x: layout.end.x, y },
      stroke: "faint",
    });
  }
  return shapes;
}

function boxCorners(centre: Vec, half: Vec, angle: number): Vec[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const corner = (i: number, j: number): Vec => ({
    x: centre.x + i * half.x * c - j * half.y * s,
    y: centre.y + i * half.x * s + j * half.y * c,
  });
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

// A compass-drawn rim: the pen wobbles a circle this size into a lump but
// keeps a polygon's vertices, so the wheel is a fine polygon.
function wheelRim(centre: Vec): Shape {
  const points: Vec[] = [];
  for (let i = 0; i < WHEEL_SIDES; i += 1) {
    const a = (i / WHEEL_SIDES) * Math.PI * 2;
    points.push({
      x: centre.x + WHEEL_RADIUS * Math.cos(a),
      y: centre.y + WHEEL_RADIUS * Math.sin(a),
    });
  }
  return { kind: "polygon", points, closed: true };
}

function blockShapes(cart: boolean): Shape[] {
  const bottom = -BLOCK_HALF.y - REST_GAP;
  const box = (low: number): Shape => ({
    kind: "polygon",
    points: [
      { x: -BLOCK_HALF.x, y: low },
      { x: BLOCK_HALF.x, y: low },
      { x: BLOCK_HALF.x, y: BLOCK_HALF.y },
      { x: -BLOCK_HALF.x, y: BLOCK_HALF.y },
    ],
    closed: true,
    fill: true,
  });
  if (!cart) {
    return [box(bottom)];
  }
  // A bed on two wheels drawn in front of it. The body slides rather than
  // rolls, so the rims carry no spokes or hubs that would have to turn.
  const axle = bottom + WHEEL_RADIUS;
  const shapes: Shape[] = [
    box(axle + WHEEL_RADIUS * 0.6),
    {
      kind: "segment",
      from: { x: -WHEEL_OFFSET, y: axle },
      to: { x: WHEEL_OFFSET, y: axle },
      stroke: "soft",
    },
  ];
  for (const x of [-WHEEL_OFFSET, WHEEL_OFFSET]) {
    shapes.push(wheelRim({ x, y: axle }));
  }
  return shapes;
}

export const INCLINED_PLANE_SETTINGS: readonly SettingSpec[] = [
  {
    key: "angle",
    label: "Slope angle",
    min: 5,
    max: 60,
    step: 1,
    defaultValue: 30,
    unit: "°",
  },
  {
    key: "friction",
    label: "Friction",
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.3,
  },
  {
    key: "mass",
    label: "Block mass",
    min: 0.5,
    max: 8,
    step: 0.5,
    defaultValue: 4,
    unit: "kg",
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

export const inclinedPlaneScene: SceneDefinition = {
  settings: INCLINED_PLANE_SETTINGS,
  camera: { x: 0, y: -0.2, height: 4, width: 4.6 },
  build(world, _page, values, variant, context) {
    const friction = values.friction ?? 0.3;
    const mass = values.mass ?? 4;
    const gravity = values.gravity ?? 9.8;
    const layout = layoutFor(values, variant);
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    // The ramp is a static body of its own so its ports have a part to sit
    // on: the wedge, a stop at the foot, and a wall at the end of the landing.
    const ramp = world.createBody({ type: "static", position: at(0, 0) });
    const wedge: Vec[] = [
      layout.foot,
      { x: layout.end.x, y: BASE_Y },
      layout.end,
      layout.top,
    ];
    const stopCentre = onSlope(layout, STOP_ALONG, STOP_HALF.y);
    const wallCentre = {
      x: layout.end.x - WALL_HALF.x,
      y: layout.end.y + WALL_HALF.y,
    };
    const rampShapes = [
      new Polygon(wedge),
      new Box(STOP_HALF.x, STOP_HALF.y, stopCentre, layout.angle),
      new Box(WALL_HALF.x, WALL_HALF.y, wallCentre),
    ];
    for (const shape of rampShapes) {
      ramp.createFixture(shape, { friction, filterCategoryBits: RAMP_BITS });
    }

    const startCentre = blockCentre(layout, layout.start);
    const block = world.createBody({
      type: "dynamic",
      position: at(startCentre.x, startCentre.y),
      angle: layout.angle,
    });
    block.createFixture(new Box(BLOCK_HALF.x, BLOCK_HALF.y), {
      density: mass / (4 * BLOCK_HALF.x * BLOCK_HALF.y),
      friction,
      filterCategoryBits: BLOCK_BITS,
    });

    // The demonstration's unseen hand pushes through this weightless,
    // frictionless, invisible body parked against the block's lower face, and
    // lets go by withdrawing it into the ramp. It collides with the block only
    // while the hand holds it; otherwise it is inert.
    const park = pusherPark(layout);
    const pusher = context.standalone
      ? world.createBody({
          type: "dynamic",
          position: at(park.x, park.y),
          gravityScale: 0,
        })
      : null;
    const pusherFixture =
      pusher?.createFixture(new Circle(PUSHER_RADIUS), {
        density: mass / 2 / (Math.PI * PUSHER_RADIUS * PUSHER_RADIUS),
        friction: 0,
        filterCategoryBits: PUSHER_BITS,
        filterMaskBits: 0,
      }) ?? null;
    let pusherActive = false;

    const rampPart: Part = {
      id: "ramp",
      body: ramp,
      shapes: [
        { kind: "polygon", points: wedge, closed: true },
        ...courseLines(layout),
        {
          kind: "polygon",
          points: boxCorners(stopCentre, STOP_HALF, layout.angle),
          closed: true,
          fill: true,
        },
        {
          kind: "polygon",
          points: boxCorners(wallCentre, WALL_HALF, 0),
          closed: true,
          fill: true,
        },
      ],
    };
    const blockPart: Part = {
      id: "block",
      body: block,
      shapes: blockShapes(layout.cart),
      grab: { hintAt: { x: 0, y: layout.cart ? 0.06 : 0 } },
    };
    const pusherPart: Part | null =
      pusher === null ? null : { id: "pusher", body: pusher, shapes: [] };

    const baseLine: Shape = {
      kind: "segment",
      from: { x: origin.x + layout.foot.x - 0.35, y: origin.y + BASE_Y },
      to: { x: origin.x + layout.end.x + 0.35, y: origin.y + BASE_Y },
      stroke: "soft",
    };

    const effortSampler = new ForceSampler();
    let effortNow = 0;
    const footRest = blockCentre(layout, FOOT_REST);

    const machine: Machine = {
      parts:
        pusherPart === null
          ? [rampPart, blockPart]
          : [rampPart, blockPart, pusherPart],
      ropes: [],
      statics: [baseLine],
      ports: [
        {
          id: "top",
          kind: "face",
          part: "ramp",
          at: { x: layout.top.x + LANDING / 2, y: layout.top.y },
          role: "load",
        },
        {
          id: "foot",
          kind: "face",
          part: "ramp",
          at: onSlope(layout, FOOT_REST, 0),
          role: "effort",
        },
        {
          id: "block",
          kind: "face",
          part: "block",
          at: { x: 0, y: BLOCK_HALF.y },
          role: "either",
        },
        {
          id: "eye",
          kind: "ropeAnchor",
          part: "block",
          at: { x: BLOCK_HALF.x, y: 0 },
          role: "either",
        },
      ],
      step(context) {
        const held = context.handPart;
        if (pusherFixture !== null) {
          const active = held !== null && held === pusherPart;
          if (active !== pusherActive) {
            pusherFixture.setFilterMaskBits(active ? BLOCK_BITS : 0);
            pusherActive = active;
          }
        }
        if (held !== null && (held === blockPart || held === pusherPart)) {
          // Effort is the hand's force along the slope; the ramp bears the rest.
          const along =
            context.handForce.x * layout.along.x +
            context.handForce.y * layout.along.y;
          effortSampler.push(Math.abs(along));
          effortNow = effortSampler.mean();
        } else {
          effortSampler.clear();
          effortNow = 0;
        }
      },
      readouts() {
        const loadForce = block.getMass() * gravity;
        const ideal = 1 / Math.sin(layout.angle);
        const holds = friction >= Math.tan(layout.angle);
        const rise = Math.max(0, block.getPosition().y - origin.y - footRest.y);
        const velocity = block.getLinearVelocity();
        const speed = velocity.length();
        const climb = velocity.x * layout.along.x + velocity.y * layout.along.y;
        const quasiStatic =
          speed < QUASI_STATIC_SPEED &&
          Math.abs(block.getAngularVelocity()) < QUASI_STATIC_SPEED;
        const readouts = [
          { label: "Load", value: formatNewtons(loadForce) },
          { label: "Ideal advantage", value: ideal.toFixed(1) },
          { label: "Holds by friction", value: holds ? "yes" : "no" },
          { label: "Height gained", value: `${rise.toFixed(2)} m` },
        ];
        if (effortNow > 0.5) {
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          readouts.push({
            label: "Advantage",
            value: !quasiStatic
              ? "moving"
              : climb > CLIMB_SPEED
                ? (loadForce / effortNow).toFixed(1)
                : "holding",
          });
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const layout = layoutFor(values, variant);
    return { partId: "block", at: blockCentre(layout, layout.start) };
  },
  script(values, variant): Script {
    const layout = layoutFor(values, variant);
    const park = pusherPark(layout);
    const push = pushDistance(layout);
    const top = {
      x: park.x + layout.along.x * push,
      y: park.y + layout.along.y * push,
    };
    // Withdrawing into the ramp lets go of the block without dragging it.
    const away = {
      x: top.x - layout.normal.x * 0.6,
      y: top.y - layout.normal.y * 0.6,
    };
    return {
      partId: "pusher",
      frames: [
        { step: 0, ...park },
        { step: 30, ...park },
        { step: 390, ...top },
        { step: 510, ...top },
        { step: 530, ...away },
      ],
      rest: 240,
    };
  },
};

export const machine: MachineModule = {
  kind: "inclined-plane",
  scene: inclinedPlaneScene,
};
