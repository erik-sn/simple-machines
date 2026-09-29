import type { Readout } from "../physics/types";

type Listener = () => void;

// A tiny external store so readouts reach React a few times a second without
// the scene re-rendering; the snapshot only changes when a value does.
export class ReadoutStore {
  private snapshot: readonly Readout[] = [];
  private readonly listeners = new Set<Listener>();

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): readonly Readout[] => this.snapshot;

  publish(next: readonly Readout[]): void {
    const same =
      next.length === this.snapshot.length &&
      next.every(
        (r, i) =>
          r.label === this.snapshot[i]?.label &&
          r.value === this.snapshot[i]?.value,
      );
    if (same) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
