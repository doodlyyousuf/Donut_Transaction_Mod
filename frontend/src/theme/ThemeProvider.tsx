import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  applyScheme, buildScheme, parseScheme, previewSwatch, serializeScheme,
  type ColorScheme, type Rgb, type SchemeVariant, type ThemeMode,
} from "./color";
import {
  BACKGROUNDS, DEFAULT_PRESET_ID, getPreset, PRESETS,
  type BackgroundStyle, type ThemePreset,
} from "./presets";

const STORAGE_KEY = "dtt:theme";
const SCHEME_KEY = "dtt:scheme";
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ThemeState {
  presetId: string;
  seed: string;
  variant: SchemeVariant;
  mode: ThemeMode;
  background: BackgroundStyle;
}

interface ThemeContextValue extends ThemeState {
  preset: ThemePreset;
  background: BackgroundStyle;
  isCustom: boolean;
  dark: boolean;
  resolvedMode: "light" | "dark";
  scheme: ColorScheme;
  setPreset: (id: string) => void;
  setCustom: (seed: string, variant?: SchemeVariant) => void;
  setMode: (m: ThemeMode) => void;
  setBackground: (b: BackgroundStyle) => void;
  cycleMode: () => void;
  reset: () => void;
  swatchOf: (preset: ThemePreset) => Rgb;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID_BACKGROUNDS = new Set<string>(BACKGROUNDS.map((b) => b.id));

function readInitialState(): ThemeState {
  const preset = getPreset(DEFAULT_PRESET_ID);
  const fallback: ThemeState = {
    presetId: preset.id,
    seed: preset.seed,
    variant: preset.variant,
    mode: "system",
    background: preset.background,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThemeState>;
    const rawPresetId = typeof parsed.presetId === "string" ? parsed.presetId : fallback.presetId;
    const isCustomStored = rawPresetId === "custom";
    const migratedPreset = getPreset(rawPresetId);
    const seedValid = HEX.test(parsed.seed ?? "");
    // A legacy preset id maps onto its closest new theme and takes that seed;
    // a "custom" pick keeps whatever seed the player chose.
    const usePresetSeed = !seedValid || (!isCustomStored && rawPresetId !== migratedPreset.id);
    return {
      presetId: isCustomStored ? "custom" : migratedPreset.id,
      seed: usePresetSeed ? migratedPreset.seed : (parsed.seed as string),
      variant: (["tonal", "vibrant", "expressive", "neutral", "monochrome"] as const)
        .includes(parsed.variant as SchemeVariant)
        ? (parsed.variant as SchemeVariant)
        : fallback.variant,
      mode: (["light", "dark", "system"] as const).includes(parsed.mode as ThemeMode)
        ? (parsed.mode as ThemeMode)
        : fallback.mode,
      background: VALID_BACKGROUNDS.has(parsed.background as string)
        ? (parsed.background as BackgroundStyle)
        : (isCustomStored ? fallback.background : migratedPreset.background),
    };
  } catch {
    return fallback;
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(readInitialState);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Track OS preference so `mode: "system"` reacts live to OS changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedMode: "light" | "dark" =
    state.mode === "system" ? (systemDark ? "dark" : "light") : state.mode;

  const scheme = useMemo(
    () => buildScheme(state.seed, state.variant, resolvedMode === "dark"),
    [state.seed, state.variant, resolvedMode]
  );

  const preset = useMemo(() => getPreset(state.presetId), [state.presetId]);
  const background = state.background;

  // Persist and apply. `dtt:scheme` is a cache the inline bootstrap script
  // replays before first paint, which is what prevents a theme flash on reload.
  useEffect(() => {
    applyScheme(scheme);
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.localStorage.setItem(SCHEME_KEY, serializeScheme(scheme));
    } catch {
      /* storage may be unavailable in private mode; theming still works */
    }
  }, [scheme, state, resolvedMode]);

  const setPreset = useCallback((id: string) => {
    const p = getPreset(id);
    setState((s) => ({ ...s, presetId: p.id, seed: p.seed, variant: p.variant, background: p.background }));
  }, []);

  const setCustom = useCallback((seed: string, variant?: SchemeVariant) => {
    if (!HEX.test(seed)) return;
    setState((s) => ({ ...s, presetId: "custom", seed, variant: variant ?? s.variant }));
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const setBackground = useCallback((background: BackgroundStyle) => {
    if (!VALID_BACKGROUNDS.has(background)) return;
    setState((s) => ({ ...s, background }));
  }, []);

  const cycleMode = useCallback(() => {
    setState((s) => {
      const order: ThemeMode[] = ["system", "light", "dark"];
      const next = order[(order.indexOf(s.mode) + 1) % order.length];
      return { ...s, mode: next };
    });
  }, []);

  const reset = useCallback(() => {
    const p = getPreset(DEFAULT_PRESET_ID);
    setState((s) => ({
      ...s, presetId: p.id, seed: p.seed, variant: p.variant, background: p.background,
    }));
  }, []);

  // Swatch cache so the theme picker does not recompute 12 palettes per render.
  const swatchCache = useRef(new Map<string, Rgb>());
  const swatchOf = useCallback((p: ThemePreset) => {
    const key = `${p.id}:${resolvedMode}`;
    const hit = swatchCache.current.get(key);
    if (hit) return hit;
    const value = previewSwatch(p.seed, p.variant, resolvedMode === "dark");
    swatchCache.current.set(key, value);
    return value;
  }, [resolvedMode]);

  const value: ThemeContextValue = {
    ...state, preset, background, isCustom: state.presetId === "custom",
    dark: resolvedMode === "dark", resolvedMode, scheme,
    setPreset, setCustom, setMode, setBackground, cycleMode, reset, swatchOf,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export { PRESETS, parseScheme };
