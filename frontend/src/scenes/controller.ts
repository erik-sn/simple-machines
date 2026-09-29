import { type Body, World } from "planck";
import type { StageMode } from "../book/chapters";
import { Hand } from "../physics/hand";
import { DT, Loop } from "../physics/loop";
import type {
  Keyframe,
  Machine,
  Part,
  Pose,
  SceneDefinition,
  Script,
  Vec,
} from "../physics/types";
import { ReadoutStore } from "./readoutStore";
import type { SettingValues } from "./settings";
import { polylineToPath } from "./shapes";

const READOUT_EVERY = 6;

function targetAt(frames: readonly Keyframe[], step: number): Vec | null {
  const last = frames[frames.length - 1];
  if (last === undefined || step > last.step) {
    return null;
  }
  const nextIndex = frames.findIndex((k) => k.step > step);
  if (nextIndex <= 0) {
    return { x: last.x, y: last.y };
  }
  const a = frames[nextIndex - 1];
  const b = frames[nextIndex];
  if (a === undefined || b === undefined) {
    return null;
  }
  const t = (step - a.step) / (b.step - a.step);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Owns one scene's world, hand, demonstration, and frame loop, and writes the
// interpolated poses straight onto the SVG groups the view hands it.
export class SceneController {
  readonly initialParts: readonly Part[];
  readonly initialMachine: Machine;
  readonly readouts = new ReadoutStore();
  private onFirstGrab: (() => void) | null = null;
  private readonly definition: SceneDefinition;
  private readonly values: SettingValues;
  private readonly variant: string | undefined;
  private world!: World;
  private machine!: Machine;
  private hand!: Hand;
  private readonly loop: Loop;
  private readonly partElements = new Map<string, SVGGElement>();
  private readonly ropeElements = new Map<string, SVGPathElement>();
  private readonly script: Script | null;
  private scriptStep = 0;
  private scriptActive: boolean;
  private grabbedOnce = false;
  private started = false;

  constructor(
    definition: SceneDefinition,
    values: SettingValues,
    variant: string | undefined,
    mode: StageMode,
  ) {
    this.definition = definition;
    this.values = values;
    this.variant = variant;
    this.buildWorld();
    this.initialMachine = this.machine;
    this.initialParts = this.machine.parts;
    this.script =
      mode === "driven" && definition.script !== undefined
        ? definition.script(values, variant)
        : null;
    this.scriptActive = this.script !== null;
    this.loop = new Loop(
      this.world,
      (step) => this.beforeStep(step),
      (poseOf) => this.draw(poseOf),
    );
    // A still page is a drawing until it is touched.
    this.loop.paused = mode === "still";
    this.readouts.publish(this.machine.readouts());
  }

  private buildWorld(): void {
    this.world = new World({ gravity: { x: 0, y: -9.8 } });
    const page = this.world.createBody();
    this.machine = this.definition.build(
      this.world,
      page,
      this.values,
      this.variant,
    );
    this.hand = new Hand(this.world, page, this.machine.parts);
  }

  poseOf(part: Part): Pose {
    const p = part.body.getPosition();
    return { x: p.x, y: p.y, angle: part.body.getAngle() };
  }

  // Called once, the first time the reader takes hold of anything.
  listenFirstGrab(listener: () => void): void {
    this.onFirstGrab = listener;
  }

  attachPart(id: string, element: SVGGElement | null): void {
    if (element === null) {
      this.partElements.delete(id);
    } else {
      this.partElements.set(id, element);
    }
  }

  attachRope(id: string, element: SVGPathElement | null): void {
    if (element === null) {
      this.ropeElements.delete(id);
    } else {
      this.ropeElements.set(id, element);
    }
  }

  start(): void {
    this.started = true;
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.hand.release();
  }

  reset(): void {
    this.hand.release();
    this.buildWorld();
    this.loop.replaceWorld(this.world);
    this.scriptStep = 0;
  }

  // Pointer interaction. Returns true when a part was taken hold of.
  grab(point: Vec): boolean {
    if (this.scriptActive) {
      this.scriptActive = false;
      this.hand.release();
    }
    const part = this.hand.grab(point);
    if (part === null) {
      return false;
    }
    this.loop.paused = false;
    if (!this.grabbedOnce) {
      this.grabbedOnce = true;
      this.onFirstGrab?.();
    }
    return true;
  }

  move(point: Vec): void {
    this.hand.move(point);
  }

  release(): void {
    this.hand.release();
  }

  private beforeStep(step: number): void {
    if (this.scriptActive && this.script !== null) {
      this.runScript(this.script);
    }
    this.machine.step({
      dt: DT,
      step,
      handForce: this.hand.force(DT),
      handPart: this.hand.part,
    });
    if (step % READOUT_EVERY === 0) {
      this.readouts.publish(this.machine.readouts());
    }
  }

  private runScript(script: Script): void {
    const part = this.machine.parts.find((p) => p.id === script.partId);
    if (part === undefined) {
      throw new Error(`Script grabs unknown part ${script.partId}`);
    }
    const target = targetAt(script.frames, this.scriptStep);
    const last = script.frames[script.frames.length - 1];
    if (target !== null) {
      if (this.scriptStep === 0) {
        this.hand.holdPart(part, target);
      } else {
        this.hand.move(target);
      }
    } else if (this.hand.part !== null) {
      this.hand.release();
    }
    this.scriptStep += 1;
    if (last !== undefined && this.scriptStep > last.step + script.rest) {
      this.reset();
    }
  }

  private draw(poseOf: (body: Body) => Pose): void {
    for (const part of this.machine.parts) {
      const element = this.partElements.get(part.id);
      if (element === undefined) {
        continue;
      }
      const pose = poseOf(part.body);
      element.setAttribute(
        "transform",
        `translate(${pose.x.toFixed(5)} ${pose.y.toFixed(5)}) rotate(${((pose.angle * 180) / Math.PI).toFixed(4)})`,
      );
    }
    for (const rope of this.machine.ropes) {
      const element = this.ropeElements.get(rope.id);
      if (element === undefined) {
        continue;
      }
      element.setAttribute(
        "d",
        rope
          .strands()
          .map((strand) => polylineToPath(strand))
          .join(" "),
      );
    }
  }

  get isStarted(): boolean {
    return this.started;
  }
}
