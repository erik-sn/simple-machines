import { type Body, MouseJoint, Vec2, type World } from "planck";
import type { Part, Vec } from "./types";

const GRAB_RADIUS = 0.2;

// The reader's hand (or the unseen one in a demonstration): a mouse joint on
// the static page body, whose reaction force is the effort readout.
export class Hand {
  private joint: MouseJoint | null = null;
  private held: Part | null = null;
  private readonly byBody = new Map<Body, Part>();
  private readonly world: World;
  private readonly page: Body;

  constructor(world: World, page: Body, parts: readonly Part[]) {
    this.world = world;
    this.page = page;
    for (const part of parts) {
      if (part.grab !== undefined) {
        this.byBody.set(part.body, part);
      }
    }
  }

  get part(): Part | null {
    return this.held;
  }

  // Takes hold of the nearest grabbable part under the point, if any.
  grab(point: Vec): Part | null {
    let hit: Part | null = null;
    let fallback: Part | null = null;
    this.world.queryAABB(
      {
        lowerBound: new Vec2(point.x - GRAB_RADIUS, point.y - GRAB_RADIUS),
        upperBound: new Vec2(point.x + GRAB_RADIUS, point.y + GRAB_RADIUS),
      },
      (fixture) => {
        const part = this.byBody.get(fixture.getBody());
        if (part === undefined) {
          return true;
        }
        if (fixture.testPoint(point)) {
          hit = part;
          return false;
        }
        fallback ??= part;
        return true;
      },
    );
    const part: Part | null = hit ?? fallback;
    if (part === null) {
      return null;
    }
    this.hold(part, point);
    return part;
  }

  // Takes hold of a named part at a point, for scripted demonstrations.
  holdPart(part: Part, point: Vec): void {
    this.hold(part, point);
  }

  private hold(part: Part, point: Vec): void {
    this.release();
    const target = new Vec2(point.x, point.y);
    const joint = this.world.createJoint(
      new MouseJoint(
        {
          maxForce: 1000 * part.body.getMass(),
          frequencyHz: 5,
          dampingRatio: 0.7,
        },
        this.page,
        part.body,
        target,
      ),
    );
    if (joint === null) {
      throw new Error("The world refused the hand's joint");
    }
    part.body.setAwake(true);
    this.joint = joint;
    this.held = part;
  }

  move(point: Vec): void {
    this.joint?.setTarget(new Vec2(point.x, point.y));
  }

  release(): void {
    if (this.joint !== null) {
      this.world.destroyJoint(this.joint);
    }
    this.joint = null;
    this.held = null;
  }

  // Where the hand holds the part, in world metres.
  anchor(): Vec | null {
    if (this.joint === null) {
      return null;
    }
    const p = this.joint.getAnchorB();
    return { x: p.x, y: p.y };
  }

  // The force on the held part during the last step, in newtons.
  force(dt: number): Vec {
    if (this.joint === null) {
      return { x: 0, y: 0 };
    }
    const f = this.joint.getReactionForce(1 / dt);
    return { x: f.x, y: f.y };
  }
}
