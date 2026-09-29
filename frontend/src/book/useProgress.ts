import { useEffect } from "react";
import { readStorage, writeStorage } from "../lib/storage";

const KEY = "progress";

// Remembers the last page opened so the contents can offer to continue.
export function useRecordProgress(path: string): void {
  useEffect(() => {
    writeStorage(KEY, path);
  }, [path]);
}

export function readProgress(): string | null {
  const saved = readStorage(KEY);
  return saved?.startsWith("/") ? saved : null;
}
