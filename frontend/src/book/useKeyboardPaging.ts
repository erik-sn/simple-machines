import { useEffect } from "react";
import { useNavigate } from "react-router";

// Arrow keys turn the page, unless the reader is typing or inside a panel.
export function useKeyboardPaging(
  previous: string | null,
  next: string | null,
): void {
  const navigate = useNavigate();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.metaKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("dialog, input, textarea, select") !== null ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowRight" && next !== null) {
        event.preventDefault();
        navigate(next, { viewTransition: true });
      } else if (event.key === "ArrowLeft" && previous !== null) {
        event.preventDefault();
        navigate(previous, { viewTransition: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, previous, next]);
}
