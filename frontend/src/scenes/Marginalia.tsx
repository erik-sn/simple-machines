import { useSyncExternalStore } from "react";
import type { ReadoutStore } from "./readoutStore";

interface Props {
  store: ReadoutStore;
}

// The measured numbers, written in the margin like a reader's notes.
export function Marginalia({ store }: Props) {
  const readouts = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (readouts.length === 0) {
    return null;
  }
  return (
    <dl className="marginalia pointer-events-none absolute top-5 left-6 font-display text-step--1">
      {readouts.map((readout) => (
        <div key={readout.label} className="flex gap-2">
          <dt className="text-ink-soft">{readout.label}</dt>
          <dd className="text-ink">{readout.value}</dd>
        </div>
      ))}
    </dl>
  );
}
