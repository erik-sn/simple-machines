import { Box, PrismaticJoint, PulleyJoint, Vec2 } from "planck";
import type { SettingSpec, SettingValues } from "../../scenes/settings";
import { ForceSampler } from "../sampler";
import type {
  Machine,
  MachineModule,
  Part,
  Readout,
  SceneDefinition,
  Script,
  Shape,
  Vec,
} from "../types";

// The pulley: a rope over sheaves, the load on one end and the hand on the
// other (docs/research/physics.md, "Pulley"). One PulleyJoint ties the body
// that carries the load to the toggle the hand pulls, with ratio 1 / n for n
// supporting strands, so the toggle travels n times as far as the load and
// feels 1 / n of its weight. Both bodies ride vertical prismatic guides whose
// limits keep either rope length from reaching zero, where the joint turns
// singular. The rope is drawn from geometry every frame; the sheaves are
// kinematic bodies turned by the rope displacement over their radius.

const SINGLE_RADIUS = 0.22;
const TACKLE_RADIUS = 0.16;
const HUB_RADIUS = 0.03;
const SHELL_MARGIN = 0.05;
const SHELL_CHAMFER = 0.05;
const CAP_GAP = 0.03;
const CAP_HEIGHT = 0.08;
const EYE_STEM = 0.06;
const EYE_RADIUS = 0.04;
const EYE_OVERLAP = 0.015;
const HOOK_SHANK = 0.06;
const HOOK_RADIUS = 0.045;
const RING_RADIUS = 0.05;
const WEIGHT_HALF = 0.16;
const HANDLE_HALF_WIDTH = 0.09;
const HANDLE_HALF_HEIGHT = 0.03;
const HANDLE_MASS = 1;
const BLOCK_MASS = 0.3;
const BEAM_HEIGHT = 0.1;
const FIXED_ROW_Y = 1;
const CLEARANCE = 0.1;
// Guide travel on the slack side: the load may sink this far (over n) below
// where the hand holds it before its guide stops it, and the toggle rise the
// same distance before the rope is drawn slack.
const SLACK = 0.15;
// Ground anchor for the free end when the hand pulls upward: a virtual point
// well below the toggle, so the joint's second length grows with the pull.
const VIRTUAL_DROP = 2.5;
const ARC_STEPS = 16;

type Variant = "fixed" | "movable" | "tackle";

interface Extents {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

interface SheaveSpec {
  x: number;
  // In the fixed block (pinned to the page) or in the block that moves.
  fixed: boolean;
  // Rope passing over this sheave per metre of pull, signed counterclockwise
  // positive: sheaves nearer the free end turn faster.
  turns: number;
}

// Positions in world metres before the origin offset, at rest.
interface Layout {
  variant: Variant;
  strands: number;
  radius: number;
  // Which way the hand pulls the free end: -1 down off a fixed sheave, +1 up.
  pull: 1 | -1;
  fixedY: number;
  blockY: number;
  // In rope order from the tied end to the free end.
  sheaves: readonly SheaveSpec[];
  tie: { x: number; onFixed: boolean };
  frameX: number;
  blockX: number;
  freeEndX: number;
  handleY: number;
  riseMax: number;
  beamBottom: number;
  beamHalfWidth: number;
  // Null: the rope's dead end is a ring on the beam, not a block.
  fixedShell: Extents | null;
  // Null: the load hangs straight from the rope's end.
  blockShell: Extents | null;
}

function variantOf(variant: string | undefined): Variant {
  switch (variant) {
    case "movable":
      return "movable";
    case "tackle":
      return "tackle";
    default:
      return "fixed";
  }
}

function hookBottom(attachY: number): number {
  return attachY - HOOK_SHANK - HOOK_RADIUS;
}

// Where a beam's underside must sit for its hook to hold an eye whose top is
// at eyeTop.
function beamAbove(eyeTop: number): number {
  return eyeTop - EYE_OVERLAP + HOOK_RADIUS + HOOK_SHANK;
}

function shellAround(
  sheaves: readonly SheaveSpec[],
  tieX: number | null,
  radius: number,
  rowY: number,
  capEnd: "top" | "bottom",
): Extents {
  const xs = sheaves.map((s) => s.x);
  const left = Math.min(...xs.map((x) => x - radius), tieX ?? Infinity);
  const right = Math.max(...xs.map((x) => x + radius));
  return {
    left: left - SHELL_MARGIN,
    right: right + SHELL_MARGIN,
    top:
      rowY + radius + (capEnd === "top" ? CAP_GAP + CAP_HEIGHT : SHELL_MARGIN),
    bottom:
      rowY -
      radius -
      (capEnd === "bottom" ? CAP_GAP + CAP_HEIGHT : SHELL_MARGIN),
  };
}

const SINGLE_SHELL_TOP = FIXED_ROW_Y + SINGLE_RADIUS + CAP_GAP + CAP_HEIGHT;
const SINGLE_BEAM_BOTTOM = beamAbove(
  SINGLE_SHELL_TOP + EYE_STEM + 2 * EYE_RADIUS,
);

function layoutFor(values: SettingValues, variant: string | undefined): Layout {
  const kind = variantOf(variant);
  if (kind === "movable") {
    // One sheave in a block that hangs on the rope: the far end is tied to
    // a ring on the beam, the near end goes up to the hand.
    const radius = SINGLE_RADIUS;
    const beamBottom = SINGLE_BEAM_BOTTOM;
    const ringY = hookBottom(beamBottom) - EYE_RADIUS + EYE_OVERLAP;
    const tieY = ringY - EYE_RADIUS;
    const blockY = 0.22;
    const sheaves: SheaveSpec[] = [{ x: 0, fixed: false, turns: 0.5 }];
    const blockShell = shellAround(sheaves, null, radius, blockY, "bottom");
    const handleY = blockShell.top + SLACK + HANDLE_HALF_HEIGHT + CLEARANCE;
    return {
      variant: kind,
      strands: 2,
      radius,
      pull: 1,
      fixedY: tieY,
      blockY,
      sheaves,
      tie: { x: -radius, onFixed: true },
      frameX: -radius,
      blockX: 0,
      freeEndX: radius,
      handleY,
      riseMax: (tieY - CLEARANCE - handleY) / 2,
      beamBottom,
      beamHalfWidth: 0.9,
      fixedShell: null,
      blockShell,
    };
  }
  // The rope zigzags between the blocks from left to right and leaves the
  // fixed block downward. n strands support the load; with n even the rope
  // is tied to the fixed block, with n odd to the moving one. The single
  // fixed pulley is the n = 1 case with the load tied straight to the rope.
  const strands =
    kind === "tackle"
      ? Math.min(6, Math.max(2, Math.round(values.strands ?? 4)))
      : 1;
  const radius = kind === "tackle" ? TACKLE_RADIUS : SINGLE_RADIUS;
  const blockY = kind === "tackle" ? 0.22 : 0.1;
  const strandX = (k: number) => radius * (2 * k - strands);
  const tieOnFixed = strands % 2 === 0;
  const sheaves: SheaveSpec[] = [];
  for (let k = 0; k < strands; k += 1) {
    // The sheave after strand k sits between strands k and k + 1; fixed
    // sheaves turn clockwise under the pull, moving ones counterclockwise.
    const fixed = (k % 2 === 1) === tieOnFixed;
    sheaves.push({
      x: strandX(k) + radius,
      fixed,
      turns: ((fixed ? -1 : 1) * (k + 1)) / strands,
    });
  }
  const tie = { x: strandX(0), onFixed: tieOnFixed };
  const fixedShell = shellAround(
    sheaves.filter((s) => s.fixed),
    tieOnFixed ? tie.x : null,
    radius,
    FIXED_ROW_Y,
    "top",
  );
  const blockShell =
    kind === "tackle"
      ? shellAround(
          sheaves.filter((s) => !s.fixed),
          tieOnFixed ? null : tie.x,
          radius,
          blockY,
          "bottom",
        )
      : null;
  const handleY =
    kind === "tackle"
      ? fixedShell.bottom - CLEARANCE - HANDLE_HALF_HEIGHT - SLACK
      : blockY;
  const ceiling = fixedShell.bottom - CLEARANCE;
  const riseMax = Math.min(
    blockShell === null ? ceiling - blockY : ceiling - blockShell.top,
    // Keeps the toggle above the caption at full travel.
    (handleY + 0.9) / strands,
  );
  return {
    variant: kind,
    strands,
    radius,
    pull: -1,
    fixedY: FIXED_ROW_Y,
    blockY,
    sheaves,
    tie,
    frameX: (fixedShell.left + fixedShell.right) / 2,
    blockX:
      blockShell === null ? tie.x : (blockShell.left + blockShell.right) / 2,
    freeEndX: strandX(strands),
    handleY,
    riseMax,
    beamBottom: beamAbove(fixedShell.top + EYE_STEM + 2 * EYE_RADIUS),
    beamHalfWidth: kind === "tackle" ? fixedShell.right + 0.35 : 0.9,
    fixedShell,
    blockShell,
  };
}

// How far the demonstration pulls the free end: a long pull that keeps the
// load short of its ceiling and the toggle clear of the caption.
function demoPull(layout: Layout): number {
  const perStrand = layout.variant === "tackle" ? 0.28 : 0.5 / layout.strands;
  return Math.min(
    layout.handleY + 0.55,
    layout.strands * Math.min(layout.riseMax - 0.03, perStrand),
  );
}

export const PULLEY_SETTINGS: readonly SettingSpec[] = [
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
    key: "strands",
    label: "Strands",
    min: 2,
    max: 6,
    step: 1,
    defaultValue: 4,
  },
  {
    key: "sheaveFriction",
    label: "Sheave friction",
    min: 0,
    max: 20,
    step: 1,
    defaultValue: 0,
    unit: "N",
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

function formatMetres(value: number): string {
  return `${value.toFixed(2)} m`;
}

function chamfered(e: Extents, c: number): Vec[] {
  return [
    { x: e.left + c, y: e.bottom },
    { x: e.right - c, y: e.bottom },
    { x: e.right, y: e.bottom + c },
    { x: e.right, y: e.top - c },
    { x: e.right - c, y: e.top },
    { x: e.left + c, y: e.top },
    { x: e.left, y: e.top - c },
    { x: e.left, y: e.bottom + c },
  ];
}

// A block's shell: an outline hugging the sheaves, with the solid end that
// carries the eye hatched. Local coordinates relative to the sheave row.
function shellShapes(
  shell: Extents,
  ox: number,
  oy: number,
  capEnd: "top" | "bottom",
): Shape[] {
  const e = {
    left: shell.left - ox,
    right: shell.right - ox,
    bottom: shell.bottom - oy,
    top: shell.top - oy,
  };
  const c = SHELL_CHAMFER;
  const cap: Vec[] =
    capEnd === "top"
      ? [
          { x: e.left, y: e.top - CAP_HEIGHT },
          { x: e.right, y: e.top - CAP_HEIGHT },
          { x: e.right, y: e.top - c },
          { x: e.right - c, y: e.top },
          { x: e.left + c, y: e.top },
          { x: e.left, y: e.top - c },
        ]
      : [
          { x: e.left, y: e.bottom + CAP_HEIGHT },
          { x: e.left, y: e.bottom + c },
          { x: e.left + c, y: e.bottom },
          { x: e.right - c, y: e.bottom },
          { x: e.right, y: e.bottom + c },
          { x: e.right, y: e.bottom + CAP_HEIGHT },
        ];
  return [
    { kind: "polygon", points: chamfered(e, c), closed: true },
    { kind: "polygon", points: cap, closed: true, fill: true },
  ];
}

function rimShapes(x: number, radius: number): Shape[] {
  return [
    { kind: "circle", center: { x, y: 0 }, radius },
    {
      kind: "circle",
      center: { x, y: 0 },
      radius: radius - 0.03,
      stroke: "faint",
    },
  ];
}

// A hub and four spokes: the sheave's rotation reads from them.
function sheaveShapes(radius: number): Shape[] {
  const shapes: Shape[] = [
    { kind: "circle", center: { x: 0, y: 0 }, radius: HUB_RADIUS },
  ];
  const inner = HUB_RADIUS + 0.015;
  const outer = radius - 0.04;
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2;
    shapes.push({
      kind: "segment",
      from: { x: inner * Math.cos(a), y: inner * Math.sin(a) },
      to: { x: outer * Math.cos(a), y: outer * Math.sin(a) },
      stroke: "soft",
    });
  }
  return shapes;
}

// A J hook hanging from (x, attachY), its bottom centred under x.
function hookShapes(x: number, attachY: number): Shape[] {
  const yc = attachY - HOOK_SHANK;
  return [
    {
      kind: "segment",
      from: { x: x - HOOK_RADIUS, y: attachY },
      to: { x: x - HOOK_RADIUS, y: yc },
    },
    {
      kind: "arc",
      center: { x, y: yc },
      radius: HOOK_RADIUS,
      start: Math.PI,
      end: 2 * Math.PI,
    },
    {
      kind: "segment",
      from: { x: x + HOOK_RADIUS, y: yc },
      to: { x: x + HOOK_RADIUS, y: yc + 0.025 },
    },
  ];
}

// A stem and an eye below an attachment point; returns the eye's centre y.
function eyeBelow(attachY: number, shapes: Shape[]): number {
  const eyeY = attachY - EYE_STEM - EYE_RADIUS;
  shapes.push(
    {
      kind: "segment",
      from: { x: 0, y: attachY },
      to: { x: 0, y: attachY - EYE_STEM },
    },
    { kind: "circle", center: { x: 0, y: eyeY }, radius: EYE_RADIUS },
  );
  return eyeY;
}

function thimble(at: Vec): Shape {
  return { kind: "circle", center: at, radius: 0.03, stroke: "soft" };
}

// A hatched weight whose ring links through an eye centred at eyeY.
function weightShapes(eyeY: number): Shape[] {
  const ringY = eyeY - RING_RADIUS;
  const cy = ringY - WEIGHT_HALF;
  return [
    {
      kind: "polygon",
      points: [
        { x: -WEIGHT_HALF, y: cy - WEIGHT_HALF },
        { x: WEIGHT_HALF, y: cy - WEIGHT_HALF },
        { x: WEIGHT_HALF, y: cy + WEIGHT_HALF },
        { x: -WEIGHT_HALF, y: cy + WEIGHT_HALF },
      ],
      closed: true,
      fill: true,
    },
    {
      kind: "arc",
      center: { x: 0, y: ringY },
      radius: RING_RADIUS,
      start: 0,
      end: Math.PI,
      stroke: "soft",
    },
  ];
}

function arcPoints(center: Vec, radius: number, over: boolean): Vec[] {
  const points: Vec[] = [];
  for (let i = 1; i <= ARC_STEPS; i += 1) {
    const t = i / ARC_STEPS;
    // Over the top from the left tangent to the right, or under the bottom.
    const a = over ? Math.PI - Math.PI * t : Math.PI + Math.PI * t;
    points.push({
      x: center.x + radius * Math.cos(a),
      y: center.y + radius * Math.sin(a),
    });
  }
  return points;
}

// A slack strand: a quadratic bow sideways, since both ends share a vertical.
function bowed(a: Vec, b: Vec, bow: number): Vec[] {
  const cx = (a.x + b.x) / 2 + 2 * bow;
  const cy = (a.y + b.y) / 2;
  const points: Vec[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const t = i / 10;
    const u = 1 - t;
    points.push({
      x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
    });
  }
  return points;
}

export const pulleyScene: SceneDefinition = {
  settings: PULLEY_SETTINGS,
  camera: { x: 0, y: -0.1, height: 4, width: 4.6 },
  build(world, page, values, variant, context) {
    const loadMass = values.load ?? 4;
    const gravity = values.gravity ?? 9.8;
    const sheaveFriction = values.sheaveFriction ?? 0;
    const layout = layoutFor(values, variant);
    const { strands, radius } = layout;
    const { origin } = context;
    const at = (x: number, y: number) => new Vec2(origin.x + x, origin.y + y);
    // The rope meets the toggle on the side it comes from.
    const ropeSide = -layout.pull;

    if (context.standalone) {
      world.setGravity(new Vec2(0, -gravity));
    }

    // The fixed block (or the beam ring the rope is tied to) is a static
    // body so the Theatre has a part to attach to.
    const frame = world.createBody({
      type: "static",
      position: at(layout.frameX, layout.fixedY),
    });

    // The body the rope lifts: the moving block, or the hook spliced onto
    // the rope's end for the single fixed pulley. Its shell weighs nothing in
    // the chapter so the readouts count the load alone.
    const block = world.createBody({
      type: "dynamic",
      position: at(layout.blockX, layout.blockY),
      linearDamping: 0.3,
    });
    const shell = layout.blockShell;
    const shellBox =
      shell === null
        ? { hx: 0.05, hy: 0.08, cy: -0.08 }
        : {
            hx: (shell.right - shell.left) / 2,
            hy: (shell.top - shell.bottom) / 2,
            cy: (shell.top + shell.bottom) / 2 - layout.blockY,
          };
    block.createFixture(
      new Box(shellBox.hx, shellBox.hy, new Vec2(0, shellBox.cy)),
      {
        density: context.standalone
          ? 0
          : BLOCK_MASS / (4 * shellBox.hx * shellBox.hy),
      },
    );
    const blockShapes: Shape[] = [];
    let hookAttachY = 0;
    if (shell !== null) {
      blockShapes.push(
        ...shellShapes(shell, layout.blockX, layout.blockY, "bottom"),
      );
      for (const s of layout.sheaves) {
        if (!s.fixed) {
          blockShapes.push(...rimShapes(s.x - layout.blockX, radius));
        }
      }
      if (!layout.tie.onFixed) {
        blockShapes.push(thimble({ x: layout.tie.x - layout.blockX, y: 0 }));
      }
      hookAttachY = shell.bottom - layout.blockY;
    }
    const eyeY = eyeBelow(hookAttachY, blockShapes);
    if (context.standalone) {
      const ringY = eyeY - RING_RADIUS;
      block.createFixture(
        new Box(WEIGHT_HALF, WEIGHT_HALF, new Vec2(0, ringY - WEIGHT_HALF)),
        { density: loadMass / (4 * WEIGHT_HALF * WEIGHT_HALF) },
      );
      blockShapes.push(...weightShapes(eyeY));
    }

    // The toggle at the rope's free end. Its mass steadies the solver and
    // sets the hand's strength; it weighs nothing so the effort readout is
    // the rope's tension alone.
    const handle = world.createBody({
      type: "dynamic",
      position: at(layout.freeEndX, layout.handleY),
      gravityScale: 0,
    });
    handle.createFixture(new Box(HANDLE_HALF_WIDTH, HANDLE_HALF_HEIGHT), {
      density: HANDLE_MASS / (4 * HANDLE_HALF_WIDTH * HANDLE_HALF_HEIGHT),
    });

    // Vertical guides. The load's guide stops it a little below the hold
    // (the rope goes slack past that) and short of the fixed block; the
    // toggle's limits sit just beyond, so the load's engage first.
    const blockGuide = world.createJoint(
      new PrismaticJoint(
        {
          enableLimit: true,
          lowerTranslation: -SLACK / strands,
          upperTranslation: layout.riseMax,
        },
        page,
        block,
        block.getPosition(),
        new Vec2(0, 1),
      ),
    );
    const handleTravel = layout.riseMax * strands + 0.02;
    const handleGuide = world.createJoint(
      new PrismaticJoint(
        {
          enableLimit: true,
          lowerTranslation: layout.pull < 0 ? -handleTravel : -SLACK - 0.02,
          upperTranslation: layout.pull < 0 ? SLACK + 0.02 : handleTravel,
          // Sheave friction as Coulomb friction on the toggle's guide, once
          // per sheave the rope passes.
          enableMotor: true,
          motorSpeed: 0,
          maxMotorForce: sheaveFriction * layout.sheaves.length,
        },
        page,
        handle,
        handle.getPosition(),
        new Vec2(0, 1),
      ),
    );
    if (blockGuide === null || handleGuide === null) {
      throw new Error("The world refused the pulley's guides");
    }

    const groundA = at(layout.blockX, layout.fixedY);
    const groundB =
      layout.pull < 0
        ? at(layout.freeEndX, layout.fixedY)
        : at(layout.freeEndX, layout.handleY - VIRTUAL_DROP);
    const pulley = world.createJoint(
      new PulleyJoint(
        {},
        block,
        handle,
        groundA,
        groundB,
        block.getPosition(),
        handle.getPosition(),
        1 / strands,
      ),
    );
    if (pulley === null) {
      throw new Error("The world refused the pulley joint");
    }

    const frameShapes: Shape[] = [];
    if (layout.fixedShell === null) {
      frameShapes.push({
        kind: "circle",
        center: { x: 0, y: EYE_RADIUS },
        radius: EYE_RADIUS,
      });
    } else {
      frameShapes.push(
        ...shellShapes(layout.fixedShell, layout.frameX, layout.fixedY, "top"),
      );
      for (const s of layout.sheaves) {
        if (s.fixed) {
          frameShapes.push(...rimShapes(s.x - layout.frameX, radius));
        }
      }
      if (layout.tie.onFixed) {
        frameShapes.push(thimble({ x: layout.tie.x - layout.frameX, y: 0 }));
      }
      const capTop = layout.fixedShell.top - layout.fixedY;
      frameShapes.push(
        {
          kind: "segment",
          from: { x: 0, y: capTop },
          to: { x: 0, y: capTop + EYE_STEM },
        },
        {
          kind: "circle",
          center: { x: 0, y: capTop + EYE_STEM + EYE_RADIUS },
          radius: EYE_RADIUS,
        },
      );
    }
    const frameHookY = hookBottom(layout.beamBottom) - layout.fixedY;

    const frameEye: Part = { id: "frame", body: frame, shapes: frameShapes };
    const blockPart: Part = { id: "block", body: block, shapes: blockShapes };
    const handlePart: Part = {
      id: "handle",
      body: handle,
      shapes: [
        {
          kind: "polygon",
          points: chamfered(
            {
              left: -HANDLE_HALF_WIDTH,
              right: HANDLE_HALF_WIDTH,
              bottom: -HANDLE_HALF_HEIGHT,
              top: HANDLE_HALF_HEIGHT,
            },
            0.015,
          ),
          closed: true,
          fill: true,
        },
        // The knot that ties the rope to the toggle.
        {
          kind: "circle",
          center: { x: 0, y: ropeSide * (HANDLE_HALF_HEIGHT + 0.015) },
          radius: 0.022,
          stroke: "soft",
        },
      ],
      grab: { hintAt: { x: 0, y: 0 } },
    };

    const sheaveParts = layout.sheaves.map((spec, index) => {
      const body = world.createBody({
        type: "kinematic",
        position: at(spec.x, spec.fixed ? layout.fixedY : layout.blockY),
      });
      const part: Part = {
        id: `sheave-${index}`,
        body,
        shapes: sheaveShapes(radius),
      };
      return { spec, body, part, dx: spec.x - layout.blockX };
    });

    const beam: Shape = {
      kind: "polygon",
      points: [
        { x: origin.x - layout.beamHalfWidth, y: origin.y + layout.beamBottom },
        { x: origin.x + layout.beamHalfWidth, y: origin.y + layout.beamBottom },
        {
          x: origin.x + layout.beamHalfWidth,
          y: origin.y + layout.beamBottom + BEAM_HEIGHT,
        },
        {
          x: origin.x - layout.beamHalfWidth,
          y: origin.y + layout.beamBottom + BEAM_HEIGHT,
        },
      ],
      closed: true,
      fill: true,
    };
    const beamHook = hookShapes(
      origin.x + layout.frameX,
      origin.y + layout.beamBottom,
    );

    const effortSampler = new ForceSampler();
    let effortNow = 0;
    let tension = 0;
    let grabOrigin: { pulled: number; raised: number } | null = null;
    const pulled = () => layout.pull * handleGuide.getJointTranslation();
    const raised = () => blockGuide.getJointTranslation();

    const ropePoints = (): Vec[] => {
      const rowY = (fixed: boolean) =>
        fixed ? origin.y + layout.fixedY : block.getPosition().y;
      const points: Vec[] = [
        { x: origin.x + layout.tie.x, y: rowY(layout.tie.onFixed) },
      ];
      for (const s of layout.sheaves) {
        const center = { x: origin.x + s.x, y: rowY(s.fixed) };
        points.push({ x: center.x - radius, y: center.y });
        points.push(...arcPoints(center, radius, s.fixed));
      }
      const last = points[points.length - 1];
      const end = {
        x: origin.x + layout.freeEndX,
        y: handle.getPosition().y + ropeSide * HANDLE_HALF_HEIGHT,
      };
      if (last !== undefined && tension < -0.5) {
        points.push(
          ...bowed(last, end, Math.min(0.2, 0.12 * Math.abs(last.y - end.y))),
        );
      } else {
        points.push(end);
      }
      return points;
    };

    const machine: Machine = {
      parts: [
        frameEye,
        blockPart,
        handlePart,
        ...sheaveParts.map((s) => s.part),
      ],
      ropes: [{ id: "rope", strands: () => [ropePoints()] }],
      statics: [beam, ...beamHook],
      ports: [
        {
          id: "free-end",
          kind: "handle",
          part: "handle",
          at: { x: 0, y: 0 },
          role: "effort",
        },
        {
          id: "hook",
          kind: "pin",
          part: "block",
          at: { x: 0, y: eyeY },
          role: "load",
        },
        {
          id: "anchor",
          kind: "ropeAnchor",
          part: "frame",
          at: { x: 0, y: frameHookY },
          role: "either",
        },
      ],
      step(context) {
        if (context.handPart === handlePart) {
          // Effort is the hand's pull along the rope; the guide takes the rest.
          effortSampler.push(Math.abs(context.handForce.y));
          effortNow = effortSampler.mean();
          grabOrigin ??= { pulled: pulled(), raised: raised() };
        } else {
          effortSampler.clear();
          effortNow = 0;
          grabOrigin = null;
        }
        // The joint's reaction points from the free end's ground anchor to
        // the toggle when the rope is taut; pushed into compression, the
        // free end is drawn slack.
        const anchor = handle.getPosition();
        const ux = anchor.x - groundB.x;
        const uy = anchor.y - groundB.y;
        const length = Math.hypot(ux, uy);
        // The joint's unit vectors exist only after its first solve.
        if (context.step > 0 && length > 0) {
          const reaction = pulley.getReactionForce(1 / context.dt);
          tension = (reaction.x * ux + reaction.y * uy) / length;
        } else {
          tension = 0;
        }

        const pull = pulled();
        const speed = layout.pull * handleGuide.getJointSpeed();
        const blockPosition = block.getPosition();
        const blockVelocity = block.getLinearVelocity();
        for (const s of sheaveParts) {
          const angle = (s.spec.turns * pull) / radius;
          if (s.spec.fixed) {
            s.body.setAngle(angle);
          } else {
            s.body.setTransform(
              new Vec2(blockPosition.x + s.dx, blockPosition.y),
              angle,
            );
            s.body.setLinearVelocity(blockVelocity);
          }
          s.body.setAngularVelocity((s.spec.turns * speed) / radius);
        }
      },
      readouts() {
        const loadForce = block.getMass() * gravity;
        const settled =
          block.getLinearVelocity().length() < 0.05 &&
          handle.getLinearVelocity().length() < 0.15;
        const readouts: Readout[] = [
          { label: "Load", value: formatNewtons(loadForce) },
          { label: "Ideal advantage", value: strands.toFixed(1) },
        ];
        if (effortNow > 0.5) {
          readouts.push({ label: "Effort", value: formatNewtons(effortNow) });
          readouts.push({
            label: "Advantage",
            value: settled ? (loadForce / effortNow).toFixed(1) : "moving",
          });
        }
        if (grabOrigin !== null) {
          const ropePulled = pulled() - grabOrigin.pulled;
          const loadRaised = raised() - grabOrigin.raised;
          if (ropePulled > 0.005) {
            readouts.push({
              label: "Rope pulled",
              value: formatMetres(ropePulled),
            });
            readouts.push({
              label: "Load raised",
              value: formatMetres(Math.max(0, loadRaised)),
            });
          }
        }
        return readouts;
      },
    };
    return machine;
  },
  hold(values, variant) {
    const layout = layoutFor(values, variant);
    return {
      partId: "handle",
      at: { x: layout.freeEndX, y: layout.handleY },
    };
  },
  script(values, variant): Script {
    const layout = layoutFor(values, variant);
    const x = layout.freeEndX;
    const y = layout.handleY;
    const pulledTo = y + layout.pull * demoPull(layout);
    return {
      partId: "handle",
      frames: [
        { step: 0, x, y },
        { step: 40, x, y },
        { step: 370, x, y: pulledTo },
        { step: 460, x, y: pulledTo },
        { step: 670, x, y },
        { step: 730, x, y },
      ],
      rest: 60,
    };
  },
};

export const machine: MachineModule = { kind: "pulley", scene: pulleyScene };
