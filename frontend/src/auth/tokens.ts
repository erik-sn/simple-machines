// template-managed (bootstrap): do not edit. Delete this line to take ownership.
// Token persistence. localStorage is the pragmatic SPA default; the tradeoff
// (readable by successful XSS) is accepted and documented in docs/template.md.

export interface StoredTokens {
  access: string;
  refresh: string;
}

const STORAGE_KEY = "auth-tokens";

export function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as StoredTokens);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: StoredTokens): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage unavailable (private mode); the session lasts until reload.
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore: nothing to clear.
  }
}
