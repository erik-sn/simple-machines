import type { Body, World } from "planck";
import type { MachineKind } from "../book/chapters";
import type { SettingSpec, SettingValues } from "../scenes/settings";

// World units are metres, y up, gravity down; a "fixed" part is a static body
// pinned to the page (docs/research/physics.md, section 2).

export interface Vec {
  x: number;
  y: number;
}

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

// Which ink a shape is drawn in; the theme decides the colour and weight.
export type Stroke = "ink" | "soft" | "faint" | "accent";

// A dashed line type of technical drawing; the ink theme leaves it plain.
export type Dash = "center" | "hidden";

export type Shape =
  | {
      kind: "segment";
      from: Vec;
      to: Vec;
      stroke?: Stroke;
      weight?: number;
      dash?: Dash;
    }
  | {
      kind: "polygon";
      points: readonly Vec[];
      closed?: boolean;
      // A filled polygon is hatched. An engraver hatches only the shadow
      // side: draw a thin band polygon with fill and no outline for that.
      fill?: boolean;
      outline?: boolean;
      hatch?: { angle: number };
      // Painted paper-white first, so it hides whatever was drawn before it
      // (a nut in front of a thread, a block in front of a rope).
      opaque?: boolean;
      stroke?: Stroke;
      weight?: number;
      dash?: Dash;
    }
  | {
      kind: "circle";
      center: Vec;
      radius: number;
      fill?: boolean;
      hatch?: { angle: number };
      opaque?: boolean;
      stroke?: Stroke;
      weight?: number;
      dash?: Dash;
    }
  | {
      kind: "arc";
      center: Vec;
      radius: number;
      // Radians, counterclockwise from +x, end greater than start.
      start: number;
      end: number;
      stroke?: Stroke;
      weight?: number;
      dash?: Dash;
    };

// One rigid body and its drawing, in body-local coordinates.
export interface Part {
  id: string;
  body: Body;
  shapes: readonly Shape[];
  // The hand may take hold of this part; the hint ring sits at hintAt.
  grab?: { hintAt: Vec };
}

// A rope is geometry, not a body: its strands are recomputed every frame.
export interface Rope {
  id: string;
  strands: () => readonly (readonly Vec[])[];
  stroke?: Stroke;
}

export interface Readout {
  label: string;
  value: string;
}

export interface StepContext {
  dt: number;
  step: number;
  // The force the hand is exerting this step, in newtons; zero when idle.
  handForce: Vec;
  handPart: Part | null;
  // Where on the part the hand holds, in world metres; null when idle.
  handAnchor: Vec | null;
  // True when the reader holds the part; false for the unseen hand of a
  // still plate or a demonstration, whose effort is not the reader's.
  handIsReader: boolean;
}

// Where a machine can be joined to another in the Theatre
// (docs/research/physics.md, "Port compatibility"). `at` is in the part's
// local frame.
export type PortKind =
  | "pin"
  | "ropeEnd"
  | "ropeAnchor"
  | "face"
  | "handle"
  | "shaft";

export interface Port {
  id: string;
  kind: PortKind;
  part: string;
  at: Vec;
  role: "effort" | "load" | "either";
}

export interface Machine {
  parts: readonly Part[];
  ropes: readonly Rope[];
  // Ink that never moves, in world coordinates.
  statics: readonly Shape[];
  ports: readonly Port[];
  // Called before every physics step.
  step: (context: StepContext) => void;
  readouts: () => readonly Readout[];
}

export interface BuildContext {
  // A chapter shows the machine with its own load and demonstration; the
  // Theatre builds it bare, with ports for whatever the visitor attaches.
  standalone: boolean;
  // Every world coordinate the builder creates is offset by this point, so
  // one builder serves both the chapter (origin 0,0) and the Theatre.
  origin: Vec;
  // The Theatre pins a free body (a weight) to the page until it is attached
  // to something; machines have fixed frames regardless.
  pinned?: boolean;
}

export interface Keyframe {
  step: number;
  x: number;
  y: number;
}

// A demonstration: the unseen hand grabs one part and follows the keyframes,
// holds the last one for `rest` steps, then the scene resets and replays.
// Infinity holds forever, which is how a still plate waits to be touched.
export interface Script {
  partId: string;
  frames: readonly Keyframe[];
  rest: number;
  // The step at which the hand lets go, if before the reset: what the
  // machine does on its own (locks, unwinds, falls) is part of the lesson.
  release?: number;
}

// Where the unseen hand holds a still plate at rest.
export interface Hold {
  partId: string;
  at: Vec;
}

export interface Camera {
  x: number;
  y: number;
  // Visible height in metres; width follows the viewport's aspect, but the
  // view widens (showing more height) until at least `width` metres fit.
  height: number;
  width: number;
}

// What each file in physics/machines exports; the registry collects them.
export interface MachineModule {
  kind: MachineKind;
  scene: SceneDefinition;
}

export interface SceneDefinition {
  settings: readonly SettingSpec[];
  camera: Camera;
  build: (
    world: World,
    page: Body,
    values: SettingValues,
    variant: string | undefined,
    context: BuildContext,
  ) => Machine;
  script?: (values: SettingValues, variant: string | undefined) => Script;
  hold?: (values: SettingValues, variant: string | undefined) => Hold;
}
