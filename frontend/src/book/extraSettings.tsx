import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import type { SettingSpec, SettingValues } from "../scenes/settings";

// A scene can add a section to the settings panel: the Theatre uses it for
// the machine the visitor last placed or moved. The section is an external
// store rather than React state so a scene can publish it from an effect.
export interface ExtraSection {
  title: string;
  specs: readonly SettingSpec[];
  values: SettingValues;
  onChange: (key: string, value: number) => void;
  onRemove: () => void;
  // Present for things that can be pinned to the page.
  pinned?: boolean;
  onTogglePinned?: () => void;
}

class ExtraSettingsStore {
  private section: ExtraSection | null = null;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): ExtraSection | null => this.section;

  readonly set = (section: ExtraSection | null): void => {
    this.section = section;
    for (const listener of this.listeners) {
      listener();
    }
  };
}

const ExtraSettingsContext = createContext<ExtraSettingsStore | null>(null);

interface Props {
  children: ReactNode;
}

export function ExtraSettingsProvider({ children }: Props) {
  const [store] = useState(() => new ExtraSettingsStore());
  return <ExtraSettingsContext value={store}>{children}</ExtraSettingsContext>;
}

function useStore(): ExtraSettingsStore {
  const store = useContext(ExtraSettingsContext);
  if (store === null) {
    throw new Error(
      "useExtraSettings must be used inside ExtraSettingsProvider",
    );
  }
  return store;
}

// For the settings panel: the current section, re-rendering when it changes.
export function useExtraSection(): ExtraSection | null {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

// For a scene: publish or clear its section.
export function useSetExtraSection(): (section: ExtraSection | null) => void {
  return useStore().set;
}
