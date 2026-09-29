import { useEffect, useId, useRef } from "react";
import type { SettingSpec, SettingValues } from "../scenes/settings";
import { useTheme } from "../theme/ThemeProvider";
import { THEMES } from "../theme/themes";
import { useExtraSection } from "./extraSettings";

interface Props {
  open: boolean;
  onClose: () => void;
  specs: readonly SettingSpec[];
  values: SettingValues;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
}

// A non-modal panel: the reader tunes a slider while the scene keeps moving.
export function SettingsPanel({
  open,
  onClose,
  specs,
  values,
  onChange,
  onReset,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const themeGroupId = useId();
  const { theme, setTheme } = useTheme();
  const section = useExtraSection();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.show();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // A non-modal panel gets no native cancel: Escape closes it from anywhere.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
      className="bg-paper text-ink absolute top-14 right-4 left-auto m-0 w-72 border border-ink-faint p-5 shadow-none"
    >
      <div className="flex items-baseline justify-between">
        <h2
          id={headingId}
          className="font-display text-sm lowercase tracking-widest"
        >
          Settings
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="text-ink-soft hover:text-ink font-display text-xl leading-none"
        >
          ×
        </button>
      </div>
      <fieldset className="mt-4 border-0 p-0">
        <legend id={themeGroupId} className="font-body text-ink-soft text-sm">
          Paper
        </legend>
        <div className="mt-1 space-y-1">
          {THEMES.map((option) => (
            <label
              key={option.id}
              className="font-body flex items-center gap-2 text-base"
            >
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => setTheme(option.id)}
              />
              {option.name}
            </label>
          ))}
        </div>
      </fieldset>
      {specs.length > 0 && (
        <div className="mt-4 space-y-3">
          {specs.map((spec) => (
            <label key={spec.key} className="font-body block text-sm">
              <span className="flex justify-between">
                <span>{spec.label}</span>
                <span className="text-ink-soft">
                  {values[spec.key] ?? spec.defaultValue}
                  {spec.unit !== undefined ? ` ${spec.unit}` : ""}
                </span>
              </span>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={values[spec.key] ?? spec.defaultValue}
                onChange={(event) =>
                  onChange(spec.key, Number(event.currentTarget.value))
                }
                className="mt-1 w-full"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="font-display text-ink-soft hover:text-ink text-xs lowercase tracking-widest"
          >
            Reset
          </button>
        </div>
      )}
      {section !== null && (
        <div className="mt-5 space-y-3 border-ink-faint border-t pt-4">
          <h3 className="font-display text-ink-soft text-xs lowercase tracking-widest">
            {section.title}
          </h3>
          {section.specs.map((spec) => (
            <label key={spec.key} className="font-body block text-sm">
              <span className="flex justify-between">
                <span>{spec.label}</span>
                <span className="text-ink-soft">
                  {section.values[spec.key] ?? spec.defaultValue}
                  {spec.unit !== undefined ? ` ${spec.unit}` : ""}
                </span>
              </span>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={section.values[spec.key] ?? spec.defaultValue}
                onChange={(event) =>
                  section.onChange(spec.key, Number(event.currentTarget.value))
                }
                className="mt-1 w-full"
              />
            </label>
          ))}
          {section.onTogglePinned !== undefined && (
            <label className="font-body flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={section.pinned === true}
                onChange={section.onTogglePinned}
              />
              Pinned to the page
            </label>
          )}
          <button
            type="button"
            onClick={section.onRemove}
            className="font-display text-ink-soft hover:text-ink text-xs lowercase tracking-widest"
          >
            Remove it from the bench
          </button>
        </div>
      )}
    </dialog>
  );
}
