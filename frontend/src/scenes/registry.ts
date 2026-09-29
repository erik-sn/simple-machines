import type { SceneKind } from "../book/chapters";
import { leverScene } from "../physics/machines/lever";
import type { SceneDefinition } from "../physics/types";

// Every scene the book can show. A kind missing here renders a placeholder.
const SCENES: Partial<Record<SceneKind, SceneDefinition>> = {
  lever: leverScene,
  frontispiece: leverScene,
};

export function sceneFor(kind: SceneKind): SceneDefinition | undefined {
  return SCENES[kind];
}
