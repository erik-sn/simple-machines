import type { Body, World } from "planck";
import type { Pose } from "./types";

export const DT = 1 / 60;
const MAX_FRAME = 0.25;
const VELOCITY_ITERATIONS = 8;
const POSITION_ITERATIONS = 3;

// Fixed-step simulation with an accumulator and render interpolation
// (docs/research/physics.md, section 4). Slow motion scales accumulated
// time, never the step, so results stay deterministic.
export class Loop {
  private accumulator = 0;
  private last: number | null = null;
  private previous = new Map<Body, Pose>();
  private frameHandle: number | null = null;
  private stepCount = 0;
  timeScale = 1;
  paused = false;
  private world: World;
  private readonly beforeStep: (step: number) => void;
  private readonly draw: (poseOf: (body: Body) => Pose) => void;

  constructor(
    world: World,
    beforeStep: (step: number) => void,
    draw: (poseOf: (body: Body) => Pose) => void,
  ) {
    this.world = world;
    this.beforeStep = beforeStep;
    this.draw = draw;
  }

  get step(): number {
    return this.stepCount;
  }

  // Swap in a rebuilt world (reset); the step count restarts.
  replaceWorld(world: World): void {
    this.world = world;
    this.previous = new Map();
    this.accumulator = 0;
    this.stepCount = 0;
  }

  start(): void {
    if (this.frameHandle === null) {
      this.last = null;
      this.frameHandle = requestAnimationFrame(this.frame);
    }
  }

  stop(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private readonly frame = (now: number): void => {
    const frameTime =
      this.last === null ? 0 : Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    if (!this.paused) {
      this.accumulator += frameTime * this.timeScale;
    }
    while (this.accumulator >= DT) {
      for (let b = this.world.getBodyList(); b !== null; b = b.getNext()) {
        const p = b.getPosition();
        this.previous.set(b, { x: p.x, y: p.y, angle: b.getAngle() });
      }
      this.beforeStep(this.stepCount);
      this.world.step(DT, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
      this.stepCount += 1;
      this.accumulator -= DT;
    }
    const alpha = this.paused ? 1 : this.accumulator / DT;
    this.draw((body) => {
      const p = body.getPosition();
      const angle = body.getAngle();
      const q = this.previous.get(body);
      if (q === undefined) {
        return { x: p.x, y: p.y, angle };
      }
      // Shortest arc, so a wheel crossing ±π does not spin the wrong way.
      const da = Math.atan2(
        Math.sin(angle - q.angle),
        Math.cos(angle - q.angle),
      );
      return {
        x: q.x + (p.x - q.x) * alpha,
        y: q.y + (p.y - q.y) * alpha,
        angle: q.angle + da * alpha,
      };
    });
    this.frameHandle = requestAnimationFrame(this.frame);
  };
}
