import { useEffect, useId, useRef } from "react";
import { Link } from "react-router";
import { CHAPTERS } from "./chapters";
import { stagePath } from "./paths";
import { readProgress } from "./useProgress";

interface Props {
  open: boolean;
  onClose: () => void;
}

// A modal: what this is, the contents, and where to continue.
export function AboutPanel({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const progress = open ? readProgress() : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={onClose}
      className="bg-paper text-ink m-auto w-full max-w-md border border-ink-faint p-8"
    >
      <div className="flex items-baseline justify-between">
        <h2
          id={headingId}
          className="font-display text-sm uppercase tracking-widest"
        >
          About
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-ink-soft hover:text-ink font-display text-xl leading-none"
        >
          ×
        </button>
      </div>
      <p className="font-body mt-4 text-base leading-relaxed">
        A short book on the six simple machines. Every drawing is a working
        model: touch it and it obeys the same laws it did in 1600.
      </p>
      <h3 className="font-display text-ink-soft mt-6 text-xs uppercase tracking-widest">
        Contents
      </h3>
      <ol className="font-body mt-2 space-y-1">
        {CHAPTERS.map((chapter) => (
          <li key={chapter.slug}>
            <Link
              to={stagePath(chapter, 0)}
              viewTransition
              onClick={onClose}
              className="hover:underline"
            >
              {chapter.numeral !== null && (
                <span className="text-ink-soft">{chapter.numeral}. </span>
              )}
              {chapter.title}
            </Link>
          </li>
        ))}
      </ol>
      {progress !== null && progress !== "/" && (
        <p className="font-body mt-4 text-sm">
          <Link
            to={progress}
            viewTransition
            onClick={onClose}
            className="underline"
          >
            Continue where you left off
          </Link>
        </p>
      )}
      <p className="font-body text-ink-soft mt-6 text-sm">
        Source and credits:{" "}
        <a
          href="https://github.com/erik-sn/simple-machines"
          className="underline"
        >
          github.com/erik-sn/simple-machines
        </a>
      </p>
    </dialog>
  );
}
