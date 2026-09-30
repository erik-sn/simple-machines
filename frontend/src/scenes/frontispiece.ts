import type { MachineKind } from "../book/chapters";
import type { Machine, SceneDefinition, Vec } from "../physics/types";
import { machineScene } from "./registry";
import { defaultValues } from "./settings";

// The title page's plate: all six machines on one sheet, in the order of the
// 1629 "Potentiae Mechanicae Sex" plates, each built standalone with its own
// load so the page promises the whole book. The lever is the one the unseen
// hand holds and the reader may take.
interface Placement {
  kind: MachineKind;
  variant?: string;
  origin: Vec;
}

const PLACEMENTS: readonly Placement[] = [
  { kind: "lever", origin: { x: -2.7, y: 0.9 } },
  { kind: "pulley", variant: "tackle", origin: { x: 0.2, y: 0.6 } },
  { kind: "wheel-and-axle", variant: "windlass", origin: { x: 3.2, y: 1.0 } },
  { kind: "wedge", variant: "log", origin: { x: -3.0, y: -1.4 } },
  { kind: "screw", origin: { x: 0, y: -1.5 } },
  { kind: "inclined-plane", origin: { x: 2.2, y: -1.5 } },
];

export const frontispieceScene: SceneDefinition = {
  settings: [],
  camera: { x: 0, y: 1.3, height: 4.2, width: 9.4 },
  build(world, page, _values, _variant, context) {
    const built = PLACEMENTS.map((placement) => {
      const scene = machineScene(placement.kind);
      const machine = scene.build(
        world,
        page,
        defaultValues(scene.settings),
        placement.variant,
        {
          standalone: true,
          origin: {
            x: context.origin.x + placement.origin.x,
            y: context.origin.y + placement.origin.y,
          },
        },
      );
      return { placement, machine };
    });
    const composite: Machine = {
      parts: built.flatMap(({ placement, machine }) =>
        machine.parts.map((part) => ({
          ...part,
          id: `${placement.kind}/${part.id}`,
          // Only the lever invites the hand on the title page.
          grab: placement.kind === "lever" ? part.grab : undefined,
        })),
      ),
      ropes: built.flatMap(({ placement, machine }) =>
        machine.ropes.map((rope) => ({
          ...rope,
          id: `${placement.kind}/${rope.id}`,
        })),
      ),
      statics: built.flatMap(({ machine }) => machine.statics),
      ports: [],
      step(stepContext) {
        for (const { machine } of built) {
          machine.step(stepContext);
        }
      },
      readouts: () => [],
    };
    return composite;
  },
  hold(_values, _variant) {
    const lever = machineScene("lever");
    const placement = PLACEMENTS[0];
    if (lever.hold === undefined || placement === undefined) {
      throw new Error("The lever has no hold for the frontispiece");
    }
    const hold = lever.hold(defaultValues(lever.settings), placement.variant);
    return {
      partId: `lever/${hold.partId}`,
      at: {
        x: hold.at.x + placement.origin.x,
        y: hold.at.y + placement.origin.y,
      },
    };
  },
};
