import { type Body, RevoluteJoint, RopeJoint, Vec2, World } from "planck";
import { Hand } from "../physics/hand";
import { DT, Loop } from "../physics/loop";
import { ForceSampler } from "../physics/sampler";
import type {
  Machine,
  Part,
  Port,
  Pose,
  SceneDefinition,
  Vec,
} from "../physics/types";
import { ReadoutStore } from "../scenes/readoutStore";
import { defaultValues, type SettingValues } from "../scenes/settings";
import { polylineToPath } from "../scenes/shapes";
import type { Composition, MachineNode, PortRef } from "./composition";
import { prefabFor } from "./prefabs";

const READOUT_EVERY = 6;

export interface NodeInstance {
  node: MachineNode;
  definition: SceneDefinition;
  values: SettingValues;
  machine: Machine;
}

// A port resolved against the built world: the body it rides and its local
// point on that body (ports on static ink ride the page body).
export interface WorldPort {
  node: MachineNode;
  port: Port;
  body: Body;
  local: Vec2;
  fixed: boolean;
}

export function partKey(nodeId: string, partId: string): string {
  return `${nodeId}/${partId}`;
}

// Saved settings are clamped to their specs: a link may carry any number.
export function nodeValues(
  node: MachineNode,
  definition: SceneDefinition,
): SettingValues {
  const values: Record<string, number> = {
    ...defaultValues(definition.settings),
  };
  for (const spec of definition.settings) {
    const saved = node.settings[spec.key];
    if (saved !== undefined && Number.isFinite(saved)) {
      values[spec.key] = Math.min(spec.max, Math.max(spec.min, saved));
    }
  }
  return values;
}

// Builds every machine on the bench at its place, joins them as the links
// say, and runs the one shared world.
export class TheatreController {
  readonly readouts = new ReadoutStore();
  readonly instances: readonly NodeInstance[];
  readonly linkRopes: readonly { id: string; a: WorldPort; b: WorldPort }[];
  private readonly world: World;
  private readonly page: Body;
  private readonly hand: Hand;
  private readonly loop: Loop;
  private readonly partElements = new Map<string, SVGGElement>();
  private readonly ropeElements = new Map<string, SVGPathElement>();
  private readonly ownerOfPart = new Map<Part, NodeInstance>();
  private lastHeld: NodeInstance | null = null;
  private readonly effortSampler = new ForceSampler();
  private readonly gravity: number;
  private readonly composition: Composition;

  constructor(composition: Composition, gravity: number) {
    this.gravity = gravity;
    this.composition = composition;
    this.world = new World({ gravity: { x: 0, y: -gravity } });
    this.page = this.world.createBody();
    const instances: NodeInstance[] = [];
    for (const node of composition.nodes) {
      const definition = prefabFor(node.kind);
      const values = nodeValues(node, definition);
      const machine = definition.build(
        this.world,
        this.page,
        values,
        node.variant,
        {
          standalone: false,
          origin: { x: node.x, y: node.y },
          pinned: node.fixed === true,
        },
      );
      const instance = { node, definition, values, machine };
      instances.push(instance);
      for (const part of machine.parts) {
        this.ownerOfPart.set(part, instance);
      }
    }
    this.instances = instances;
    const linkRopes: { id: string; a: WorldPort; b: WorldPort }[] = [];
    composition.links.forEach((link, index) => {
      const a = this.resolvePort(link.a);
      const b = this.resolvePort(link.b);
      if (a === null || b === null) {
        throw new Error(`Link ${index} points at a port that does not exist`);
      }
      switch (link.joint) {
        case "revolute": {
          const anchor = a.body.getWorldPoint(a.local);
          this.world.createJoint(new RevoluteJoint({}, a.body, b.body, anchor));
          break;
        }
        case "rope": {
          const length = Vec2.distance(
            a.body.getWorldPoint(a.local),
            b.body.getWorldPoint(b.local),
          );
          this.world.createJoint(
            new RopeJoint({
              bodyA: a.body,
              bodyB: b.body,
              localAnchorA: a.local,
              localAnchorB: b.local,
              maxLength: Math.max(length, 0.05),
            }),
          );
          linkRopes.push({ id: `link:${index}`, a, b });
          break;
        }
        case "contact":
          break;
        default: {
          const never: never = link.joint;
          throw new Error(`Unknown joint ${String(never)}`);
        }
      }
    });
    this.linkRopes = linkRopes;
    this.hand = new Hand(
      this.world,
      this.page,
      instances.flatMap((i) => i.machine.parts),
    );
    this.loop = new Loop(
      this.world,
      (step) => this.beforeStep(step),
      (poseOf) => this.draw(poseOf),
    );
  }

  resolvePort(ref: PortRef): WorldPort | null {
    const instance = this.instances.find((i) => i.node.id === ref.node);
    const port = instance?.machine.ports.find((p) => p.id === ref.port);
    if (instance === undefined || port === undefined) {
      return null;
    }
    const part = instance.machine.parts.find((p) => p.id === port.part);
    if (part === undefined) {
      // A port on static ink: `at` is relative to the machine's origin.
      return {
        node: instance.node,
        port,
        body: this.page,
        local: new Vec2(
          instance.node.x + port.at.x,
          instance.node.y + port.at.y,
        ),
        fixed: true,
      };
    }
    return {
      node: instance.node,
      port,
      body: part.body,
      local: new Vec2(port.at.x, port.at.y),
      fixed: part.body.isStatic(),
    };
  }

  allPorts(): WorldPort[] {
    const ports: WorldPort[] = [];
    for (const instance of this.instances) {
      for (const port of instance.machine.ports) {
        const resolved = this.resolvePort({
          node: instance.node.id,
          port: port.id,
        });
        if (resolved !== null) {
          ports.push(resolved);
        }
      }
    }
    return ports;
  }

  portWorld(port: WorldPort): Vec {
    const p = port.body.getWorldPoint(port.local);
    return { x: p.x, y: p.y };
  }

  poseOf(part: Part): Pose {
    const p = part.body.getPosition();
    return { x: p.x, y: p.y, angle: part.body.getAngle() };
  }

  attachPart(key: string, element: SVGGElement | null): void {
    if (element === null) {
      this.partElements.delete(key);
    } else {
      this.partElements.set(key, element);
    }
  }

  attachRope(key: string, element: SVGPathElement | null): void {
    if (element === null) {
      this.ropeElements.delete(key);
    } else {
      this.ropeElements.set(key, element);
    }
  }

  start(): void {
    this.loop.start();
  }

  setPaused(paused: boolean): void {
    this.loop.paused = paused;
  }

  // Every machine joined, directly or through others, to the given one.
  private componentOf(nodeId: string): Set<string> {
    const seen = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      for (const link of this.composition.links) {
        const other =
          link.a.node === current
            ? link.b.node
            : link.b.node === current
              ? link.a.node
              : null;
        if (other !== null && !seen.has(other)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    return seen;
  }

  // The compound's readouts: the effort at the reader's hand against every
  // weight hanging on the chain it belongs to, which is what the Theatre is
  // for: advantages multiply through the stages.
  private compoundReadouts(): { label: string; value: string }[] {
    const held = this.hand.part;
    const owner = held === null ? null : (this.ownerOfPart.get(held) ?? null);
    if (owner === null) {
      return [];
    }
    const component = this.componentOf(owner.node.id);
    let loads = 0;
    for (const instance of this.instances) {
      if (
        instance.node.kind === "weight" &&
        component.has(instance.node.id) &&
        instance !== owner
      ) {
        loads += (instance.values.mass ?? 0) * this.gravity;
      }
    }
    const effort = this.effortSampler.mean();
    const readouts = [
      { label: "Effort", value: `${effort.toFixed(effort < 10 ? 1 : 0)} N` },
    ];
    if (loads > 0) {
      readouts.push({
        label: "Loads on the chain",
        value: `${loads.toFixed(0)} N`,
      });
      const speed = held === null ? 0 : held.body.getLinearVelocity().length();
      readouts.push({
        label: "Advantage",
        value:
          effort > 0.5 && speed < 0.15 ? (loads / effort).toFixed(1) : "moving",
      });
    }
    return readouts;
  }

  dispose(): void {
    this.loop.stop();
    this.hand.release();
  }

  grab(point: Vec): boolean {
    const part = this.hand.grab(point);
    if (part === null) {
      return false;
    }
    this.lastHeld = this.ownerOfPart.get(part) ?? null;
    return true;
  }

  move(point: Vec): void {
    this.hand.move(point);
  }

  release(): void {
    this.hand.release();
  }

  private beforeStep(step: number): void {
    const handForce = this.hand.force(DT);
    for (const instance of this.instances) {
      instance.machine.step({
        dt: DT,
        step,
        handForce,
        handPart: this.hand.part,
        handAnchor: this.hand.anchor(),
        handIsReader: this.hand.part !== null,
      });
    }
    if (this.hand.part !== null) {
      this.effortSampler.push(Math.hypot(handForce.x, handForce.y));
    } else {
      this.effortSampler.clear();
    }
    if (step % READOUT_EVERY === 0) {
      const own = (this.lastHeld?.machine.readouts() ?? []).filter(
        (r) => r.label !== "Effort" && r.label !== "Advantage",
      );
      this.readouts.publish([...own, ...this.compoundReadouts()]);
    }
  }

  private draw(poseOf: (body: Body) => Pose): void {
    for (const instance of this.instances) {
      for (const part of instance.machine.parts) {
        const element = this.partElements.get(
          partKey(instance.node.id, part.id),
        );
        if (element === undefined) {
          continue;
        }
        const pose = poseOf(part.body);
        element.setAttribute(
          "transform",
          `translate(${pose.x.toFixed(5)} ${pose.y.toFixed(5)}) rotate(${((pose.angle * 180) / Math.PI).toFixed(4)})`,
        );
      }
      for (const rope of instance.machine.ropes) {
        const element = this.ropeElements.get(
          partKey(instance.node.id, rope.id),
        );
        if (element !== undefined) {
          element.setAttribute(
            "d",
            rope
              .strands()
              .map((strand) => polylineToPath(strand))
              .join(" "),
          );
        }
      }
    }
    for (const rope of this.linkRopes) {
      const element = this.ropeElements.get(rope.id);
      if (element !== undefined) {
        element.setAttribute(
          "d",
          polylineToPath([this.portWorld(rope.a), this.portWorld(rope.b)]),
        );
      }
    }
  }
}
