import { Box, Circle, Polygon, Vec2 } from "planck";
import type { SettingSpec, SettingValues } from "../../scenes/settings";
import { blockShapes, blockSidePoint } from "../parts";
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
// Drawing only. Light falls from the upper left, so the hatched shadow bands
// sit on the ramp's vertical right face, the stop's up-slope face, and the
// wall's right edge; the slope and the landing are lit and stay plain.
const RAMP_SHADOW = 0.12;
const SHADOW_BAND = 0.03;
const HUB_RADIUS = 0.02;
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

// The ramp's shadow: a band inside its vertical right face, base line to
// landing. Nothing else on the wedge is hatched; the period plates draw the
// ramp as a plain outline.
function rampShadow(layout: Layout): Shape {
  return {
    kind: "polygon",
    points: [
      { x: layout.end.x - RAMP_SHADOW, y: BASE_Y },
      { x: layout.end.x, y: BASE_Y },
      layout.end,
      { x: layout.end.x - RAMP_SHADOW, y: layout.end.y },
    ],
    closed: true,
    fill: true,
    outline: false,
    hatch: { angle: 60 },
  };
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
  // Opaque, so the rim hides the bed's lower edge and the axle behind it.
  return { kind: "polygon", points, closed: true, opaque: true };
}

// Moves shapes along a part's local y: the shared block is drawn about its
// centre, and here it must reach down to the ramp's surface.
function shifted(shapes: readonly Shape[], dy: number): Shape[] {
  const move = (p: Vec): Vec => ({ x: p.x, y: p.y + dy });
  return shapes.map((shape) => {
    switch (shape.kind) {
      case "polygon":
        return { ...shape, points: shape.points.map(move) };
      case "segment":
        return { ...shape, from: move(shape.from), to: move(shape.to) };
      default:
        return { ...shape, center: move(shape.center) };
    }
  });
}

// The book's block, without its ring, spanning the local heights `low` to
// `high` so it appears to sit on the ramp while the body rests a hair above.
function blockBetween(low: number, high: number): Shape[] {
  return shifted(
    blockShapes({
      halfWidth: BLOCK_HALF.x,
      halfHeight: (high - low) / 2,
      ring: false,
    }),
    (low + high) / 2,
  );
}

// The local heights the drawn block spans: the sled sits on the ramp, the
// cart's bed rides above its wheels.
function blockSpan(cart: boolean): { low: number; high: number } {
  const bottom = -BLOCK_HALF.y - REST_GAP;
  return {
    low: cart ? bottom + WHEEL_RADIUS * 1.6 : bottom,
    high: BLOCK_HALF.y,
  };
}

// Where a rope ties into the block: the outer edge of its right face, so the
// rope is not hidden by the block's own opaque faces.
function eyePoint(cart: boolean): Vec {
  const { low, high } = blockSpan(cart);
  const side = blockSidePoint(BLOCK_HALF.x);
  return { x: side.x, y: side.y + (low + high) / 2 };
}

function loadShapes(cart: boolean): Shape[] {
  const { low, high } = blockSpan(cart);
  if (!cart) {
    return blockBetween(low, high);
  }
  // A bed on two wheels drawn in front of it. The body slides rather than
  // rolls, so the rims carry no spokes that would have to turn; a hub marks
  // each axle end so the rims do not read as loose circles.
  const axle = -BLOCK_HALF.y - REST_GAP + WHEEL_RADIUS;
  const shapes: Shape[] = [
    ...blockBetween(low, high),
    {
      kind: "segment",
      from: { x: -WHEEL_OFFSET, y: axle },
      to: { x: WHEEL_OFFSET, y: axle },
      stroke: "soft",
    },
  ];
  for (const x of [-WHEEL_OFFSET, WHEEL_OFFSET]) {
    shapes.push(wheelRim({ x, y: axle }));
    shapes.push({
      kind: "circle",
      center: { x, y: axle },
      radius: HUB_RADIUS,
      stroke: "soft",
    });
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

    // The ramp, stop, and wall are solids: each is an outline painted
    // opaque, with one hatched band on its shadow side. The stop's band lies
    // inside its up-slope face, measured along the slope's unit vector; the
    // wall's inside its right edge.
    const stopShadowCentre = onSlope(
      layout,
      STOP_ALONG + STOP_HALF.x - SHADOW_BAND / 2,
      STOP_HALF.y,
    );
    const wallShadowCentre = {
      x: wallCentre.x + WALL_HALF.x - SHADOW_BAND / 2,
      y: wallCentre.y,
    };
    const rampPart: Part = {
      id: "ramp",
      body: ramp,
      shapes: [
        { kind: "polygon", points: wedge, closed: true, opaque: true },
        rampShadow(layout),
        {
          kind: "polygon",
          points: boxCorners(stopCentre, STOP_HALF, layout.angle),
          closed: true,
          opaque: true,
        },
        {
          kind: "polygon",
          points: boxCorners(
            stopShadowCentre,
            { x: SHADOW_BAND / 2, y: STOP_HALF.y },
            layout.angle,
          ),
          closed: true,
          fill: true,
          outline: false,
          hatch: { angle: 70 },
        },
        {
          kind: "polygon",
          points: boxCorners(wallCentre, WALL_HALF, 0),
          closed: true,
          opaque: true,
        },
        {
          kind: "polygon",
          points: boxCorners(
            wallShadowCentre,
            { x: SHADOW_BAND / 2, y: WALL_HALF.y },
            0,
          ),
          closed: true,
          fill: true,
          outline: false,
          hatch: { angle: 65 },
        },
      ],
    };
    const blockPart: Part = {
      id: "block",
      body: block,
      shapes: loadShapes(layout.cart),
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
          at: eyePoint(layout.cart),
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
        if (
          held !== null &&
          context.handIsReader &&
          (held === blockPart || held === pusherPart)
        ) {
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
