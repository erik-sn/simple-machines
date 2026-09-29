import { useEffect } from "react";
import { useNavigate } from "react-router";
import {
  nextPosition,
  positionFromPath,
  positionPath,
  previousPosition,
} from "./paths";

// Arrow keys turn the page, unless the reader is typing or inside a panel.
// The position is read from the URL at the keypress, not from render props:
// a view transition defers the re-render, and a key pressed in that gap must
// still turn from the page the URL already names.
export function useKeyboardPaging(): void {
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
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      const position = positionFromPath(window.location.pathname);
      if (position === null) {
        return;
      }
      const destination =
        event.key === "ArrowRight"
          ? nextPosition(position)
          : previousPosition(position);
      if (destination === null) {
        return;
      }
      event.preventDefault();
      navigate(positionPath(destination), { viewTransition: true });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
