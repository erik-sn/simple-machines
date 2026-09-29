// localStorage behind a guard: a private window or blocked site data throws on
// access, and the book must still open. Reads return null when unavailable.
const PREFIX = "simple-machines:";

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage unavailable: the preference lives for this page load only.
  }
}
