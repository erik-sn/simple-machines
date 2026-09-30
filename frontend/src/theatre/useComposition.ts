import { useEffect, useState } from "react";
import {
  type Composition,
  decodeComposition,
  EMPTY_COMPOSITION,
  encodeComposition,
} from "./composition";
import { seedComposition } from "./seed";

const SESSION_KEY = "simple-machines:bench";

// The last hash this session built, so turning the Theatre's pages (whose
// URLs carry no hash) does not lose the bench.
function rememberedHash(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberHash(hash: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, hash);
  } catch {
    // Storage unavailable: the bench lives in the URL alone.
  }
}

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
    function load() {
      const hash =
        window.location.hash === "" ? rememberedHash() : window.location.hash;
      if (hash !== "" && window.location.hash === "") {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${hash}`,
        );
      }
      decodeComposition(hash).then(
        (composition) => {
          if (!cancelled) {
            setState({
              composition: hash === "" ? seedComposition() : composition,
              ready: true,
              error: null,
            });
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
    }
    load();
    window.addEventListener("hashchange", load);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", load);
    };
  }, []);

  function update(next: Composition) {
    setState({ composition: next, ready: true, error: null });
    encodeComposition(next).then(
      (hash) => {
        const full = hash === "" ? "" : `#${hash}`;
        rememberHash(full);
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${full}`,
        );
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
