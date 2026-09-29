import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { readStorage, writeStorage } from "../lib/storage";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";

interface Props {
  children: ReactNode;
}

// Owns the active theme: persisted, and mirrored onto <html data-theme> so the
// CSS variables in index.css switch for everything at once.
export function ThemeProvider({ children }: Props) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = readStorage(STORAGE_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function setTheme(next: ThemeId) {
    setThemeState(next);
    writeStorage(STORAGE_KEY, next);
  }

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
