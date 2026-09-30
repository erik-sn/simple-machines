import type { MachineKind, SceneKind } from "../book/chapters";
import type { MachineModule, SceneDefinition } from "../physics/types";
import { frontispieceScene } from "./frontispiece";

// Every file in physics/machines exports `machine`; the registry collects
// them, so adding a machine never touches this file. A kind missing here
// renders a placeholder.
const modules = import.meta.glob<MachineModule>("../physics/machines/*.ts", {
  eager: true,
  import: "machine",
});

const byKind = new Map<MachineKind, SceneDefinition>();
for (const [path, module] of Object.entries(modules)) {
  if (module === undefined) {
    throw new Error(
      `${path} does not export a machine; only machines live in physics/machines`,
    );
  }
  if (byKind.has(module.kind)) {
    throw new Error(
      `Two machine files claim the kind ${module.kind} (${path})`,
    );
  }
  byKind.set(module.kind, module.scene);
}

export function sceneFor(kind: SceneKind): SceneDefinition | undefined {
  if (kind === "frontispiece") {
    return frontispieceScene;
  }
  if (kind === "theatre") {
    return undefined;
  }
  return byKind.get(kind);
}

export function machineScene(kind: MachineKind): SceneDefinition {
  const scene = byKind.get(kind);
  if (scene === undefined) {
    throw new Error(`No machine registered for ${kind}`);
  }
  return scene;
}
