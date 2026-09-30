import { World } from "planck";
import { defaultValues } from "../scenes/settings";
import type { Composition } from "./composition";
import { prefabFor } from "./prefabs";

// What the bench shows when nobody has built anything: a block and tackle
// holding a weight, which stands still and lifts when the toggle is pulled.
// The weight is placed by building the tackle once and reading its hook.
export function seedComposition(): Composition {
  const pulley = prefabFor("pulley");
  const weight = prefabFor("weight");
  const world = new World();
  const page = world.createBody();
  const origin = { x: 0, y: 0.3 };
  const tackle = pulley.build(
    world,
    page,
    defaultValues(pulley.settings),
    "tackle",
    { standalone: false, origin },
  );
  const hook = tackle.ports.find((port) => port.id === "hook");
  const hookPart = tackle.parts.find((part) => part.id === hook?.part);
  if (hook === undefined || hookPart === undefined) {
    throw new Error(
      "The pulley prefab has no hook to hang the seed weight from",
    );
  }
  const hookAt = hookPart.body.getWorldPoint({ x: hook.at.x, y: hook.at.y });
  const block = weight.build(
    world,
    page,
    defaultValues(weight.settings),
    undefined,
    { standalone: false, origin: { x: 0, y: 0 } },
  );
  const eye = block.ports.find((port) => port.id === "eye");
  if (eye === undefined) {
    throw new Error("The weight prefab has no eye");
  }
  return {
    v: 1,
    nodes: [
      {
        id: "pu1",
        kind: "pulley",
        variant: "tackle",
        x: origin.x,
        y: origin.y,
        settings: {},
      },
      {
        id: "we1",
        kind: "weight",
        x: hookAt.x - eye.at.x,
        y: hookAt.y - eye.at.y,
        settings: {},
      },
    ],
    links: [
      {
        a: { node: "we1", port: "eye" },
        b: { node: "pu1", port: "hook" },
        joint: "revolute",
      },
    ],
  };
}
