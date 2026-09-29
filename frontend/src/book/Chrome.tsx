import { useId } from "react";
import { GearIcon } from "./GearIcon";

interface Props {
  showHint: boolean;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

// Top-right corner: the settings gear and the About link, nothing else. The
// hint appears until the reader has opened the settings once.
export function Chrome({ showHint, onOpenSettings, onOpenAbout }: Props) {
  const hintId = useId();
  return (
    <div className="absolute top-4 right-4 flex items-center gap-4">
      <button
        type="button"
        onClick={onOpenAbout}
        className="font-display text-ink-soft hover:text-ink text-sm uppercase tracking-widest"
      >
        About
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          aria-describedby={showHint ? hintId : undefined}
          className="text-ink-soft hover:text-ink block p-1"
        >
          <GearIcon />
        </button>
        {showHint && (
          <p
            id={hintId}
            role="tooltip"
            className="font-body text-ink absolute top-full right-0 mt-2 w-48 text-right text-sm leading-snug"
          >
            Tune the physics of this page here.
          </p>
        )}
      </div>
    </div>
  );
}
