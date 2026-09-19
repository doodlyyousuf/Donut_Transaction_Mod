import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";

/**
 * The dashboard has two deliberately different experiences:
 *
 * - `public`   everything trackers have observed (leaderboards, global stats)
 * - `personal` only the signed-in player's own activity (spend, earn, profit)
 *
 * The choice is per browser and persisted, so a player who only cares about
 * their own numbers never has to look at public data and vice versa.
 */
export type ViewMode = "public" | "personal";

const STORAGE_KEY = "dtt:view-mode";

interface ViewModeValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  isPersonal: boolean;
}

const ViewModeContext = createContext<ViewModeValue | null>(null);

function readInitial(): ViewMode {
  if (typeof window === "undefined") return "public";
  return window.localStorage.getItem(STORAGE_KEY) === "personal" ? "personal" : "public";
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(readInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private browsing: fall back to in-memory only */
    }
  }, [mode]);

  const setMode = useCallback((next: ViewMode) => setModeState(next), []);

  const value = useMemo(
    () => ({ mode, setMode, isPersonal: mode === "personal" }),
    [mode, setMode]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used inside ViewModeProvider");
  return ctx;
}
