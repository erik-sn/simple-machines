import { useEffect, useState } from "react";
import {
  type Composition,
  decodeComposition,
  EMPTY_COMPOSITION,
  encodeComposition,
} from "./composition";

interface State {
  composition: Composition;
  ready: boolean;
  error: string | null;
}

// The bench lives in the URL hash: decoded once on arrival, written back on
// every change, so a link to the page is a link to the build.
export function useComposition(): {
  composition: Composition;
  ready: boolean;
  error: string | null;
  update: (next: Composition) => void;
} {
  const [state, setState] = useState<State>({
    composition: EMPTY_COMPOSITION,
    ready: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    decodeComposition(window.location.hash).then(
      (composition) => {
        if (!cancelled) {
          setState({ composition, ready: true, error: null });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setState({
            composition: EMPTY_COMPOSITION,
            ready: true,
            error: message,
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function update(next: Composition) {
    setState({ composition: next, ready: true, error: null });
    encodeComposition(next).then(
      (hash) => {
        const url = `${window.location.pathname}${hash === "" ? "" : `#${hash}`}`;
        window.history.replaceState(null, "", url);
      },
      (error: unknown) => {
        throw error;
      },
    );
  }

  return {
    composition: state.composition,
    ready: state.ready,
    error: state.error,
    update,
  };
}
