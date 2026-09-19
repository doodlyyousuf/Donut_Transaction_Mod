import { useMemo } from "react";

/**
 * Recharts cannot read Tailwind classes, so charts are handed literal CSS
 * colors read from the live Material 3 palette. Centralized here so every
 * chart picks up the active theme instead of duplicating the lookup.
 */
export interface ChartColors {
  primary: string;
  secondary: string;
  tertiary: string;
  error: string;
  grid: string;
  text: string;
  surface: string;
  outline: string;
}

export function useChartColors(): ChartColors {
  return useMemo(() => {
    const read = (role: string, fallback: string) => {
      if (typeof window === "undefined") return fallback;
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--md-${role}`)
        .trim();
      return value ? `rgb(${value})` : fallback;
    };
    return {
      primary: read("primary", "#635bff"),
      secondary: read("secondary", "#605d76"),
      tertiary: read("tertiary", "#7d5260"),
      error: read("error", "#b3261e"),
      grid: read("outline-variant", "#c9c5d0"),
      text: read("on-surface-variant", "#48464f"),
      surface: read("surface-container-low", "#f7f2fa"),
      outline: read("outline", "#79747e"),
    };
  }, []);
}

export function chartTooltipStyle(colors: ChartColors) {
  return {
    contentStyle: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.outline}`,
      borderRadius: 12,
      fontSize: 12,
      color: colors.text,
    },
    itemStyle: { color: colors.text },
    labelStyle: { color: colors.text, fontWeight: 500 },
  };
}
