import type { SchemeVariant } from "./color";

/** Decorative animated backdrop applied behind the whole app. */
export type BackgroundStyle =
  | "aurora"
  | "mesh"
  | "ocean"
  | "plasma"
  | "grid"
  | "rainbow"
  | "none";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  seed: string;
  variant: SchemeVariant;
  background: BackgroundStyle;
}

export interface BackgroundOption {
  id: BackgroundStyle;
  name: string;
  description: string;
}

export const BACKGROUNDS: BackgroundOption[] = [
  { id: "aurora", name: "Aurora", description: "Soft rising color fields" },
  { id: "mesh", name: "Mesh", description: "Layered gradient mesh" },
  { id: "ocean", name: "Ocean", description: "Wide, slow horizontal drift" },
  { id: "plasma", name: "Plasma", description: "Fast, saturated movement" },
  { id: "grid", name: "Grid", description: "Technical panning grid" },
  { id: "rainbow", name: "Spectrum", description: "Full-spectrum rotation" },
  { id: "none", name: "Plain", description: "No animation, flat surface" },
];

/**
 * A curated set of accent themes. Seeds mirror the reference Material 3 picker
 * so each theme reads as a clean, professional tint rather than a wild hue
 * shift. The full palette is still generated from the seed.
 */
export const PRESETS: ThemePreset[] = [
  { id: "blue", name: "Blue", description: "Crisp corporate blue, the default", seed: "#0061A4", variant: "tonal", background: "ocean" },
  { id: "indigo", name: "Indigo", description: "Deep, rich indigo", seed: "#4F46E5", variant: "tonal", background: "mesh" },
  { id: "cyan", name: "Cyan", description: "Bright, cool cyan", seed: "#0891B2", variant: "vibrant", background: "ocean" },
  { id: "green", name: "Green", description: "Calm natural green", seed: "#2E7D32", variant: "tonal", background: "aurora" },
  { id: "amber", name: "Amber", description: "Warm golden amber", seed: "#F9A825", variant: "tonal", background: "aurora" },
  { id: "orange", name: "Orange", description: "Energetic sunset orange", seed: "#E65100", variant: "vibrant", background: "plasma" },
  { id: "red", name: "Red", description: "Confident signal red", seed: "#C62828", variant: "tonal", background: "plasma" },
  { id: "teal", name: "Teal", description: "Deep, composed teal", seed: "#00796B", variant: "tonal", background: "ocean" },
  { id: "purple", name: "Purple", description: "Balanced royal violet", seed: "#6750A4", variant: "tonal", background: "plasma" },
  { id: "blurple", name: "Blurple", description: "Vivid indigo-blue", seed: "#5865F2", variant: "expressive", background: "mesh" },
  { id: "slate", name: "Slate", description: "Neutral, understated gray", seed: "#475569", variant: "neutral", background: "grid" },
  { id: "mono", name: "Mono", description: "Pure monochrome", seed: "#111827", variant: "monochrome", background: "grid" },
];

export const DEFAULT_PRESET_ID = "blue";

/** Scheme variants the appearance dialog exposes for custom seeds. */
export const VARIANTS: { id: SchemeVariant; name: string; description: string }[] = [
  { id: "tonal", name: "Tonal", description: "Balanced, default Material 3" },
  { id: "vibrant", name: "Vibrant", description: "Higher contrast, saturated" },
  { id: "expressive", name: "Expressive", description: "Striking, shifted accents" },
  { id: "neutral", name: "Neutral", description: "Muted, almost grayscale" },
  { id: "monochrome", name: "Mono", description: "Pure black and whites" },
];

/**
 * Themes that existed before the set was trimmed. Mapping them keeps a stored
 * choice meaningful instead of silently snapping back to the default.
 */
export const LEGACY_PRESET_IDS: Record<string, string> = {
  donut: "amber",
  aurora: "blurple",
  ocean: "blue",
  emerald: "green",
  forest: "green",
  magenta: "red",
  grape: "purple",
  rose: "red",
  pink: "red",
  sunset: "orange",
  rainbow: "blurple",
  graphite: "slate",
};

export function getPreset(id: string): ThemePreset {
  const resolved = LEGACY_PRESET_IDS[id] ?? id;
  return PRESETS.find((p) => p.id === resolved) ?? PRESETS[0];
}
