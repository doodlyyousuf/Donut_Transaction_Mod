/** @type {import('tailwindcss').Config} */

// Every Material 3 color role is exposed as a Tailwind color backed by a CSS
// variable holding "R G B" channels, so opacity modifiers keep working
// (e.g. `bg-primary/12`). Values are computed at runtime from the seed color.
const ROLES = [
  "primary", "on-primary", "primary-container", "on-primary-container",
  "secondary", "on-secondary", "secondary-container", "on-secondary-container",
  "tertiary", "on-tertiary", "tertiary-container", "on-tertiary-container",
  "error", "on-error", "error-container", "on-error-container",
  "surface", "on-surface", "surface-variant", "on-surface-variant",
  "surface-dim", "surface-bright",
  "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest",
  "outline", "outline-variant",
  "inverse-surface", "inverse-on-surface", "inverse-primary",
  "scrim", "shadow",
];

const colors = Object.fromEntries(
  ROLES.map((role) => [role, `rgb(var(--md-${role}) / <alpha-value>)`])
);

// Material 3 uses state-layer opacities such as 8% and 12% that are not in
// Tailwind's default opacity scale. The color opacity modifier resolves against
// `theme.opacity`, so the full 0-100 range is registered here to keep modifiers
// like `bg-primary/12` from being silently dropped. Unused steps emit no CSS.
const opacity = Object.fromEntries(
  Array.from({ length: 101 }, (_, i) => [i, String(i / 100)])
);

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      opacity,
      fontFamily: {
        sans: ["Roboto", "system-ui", "-apple-system", "Segoe UI", "Roboto Flex", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["Roboto Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "20px", "2xl": "28px",
      },
      // Material 3 elevation levels 0-5
      boxShadow: {
        "elev-1": "0 1px 2px 0 rgb(var(--md-shadow) / 0.30), 0 1px 3px 1px rgb(var(--md-shadow) / 0.15)",
        "elev-2": "0 1px 2px 0 rgb(var(--md-shadow) / 0.30), 0 2px 6px 2px rgb(var(--md-shadow) / 0.15)",
        "elev-3": "0 4px 8px 3px rgb(var(--md-shadow) / 0.15), 0 1px 3px 0 rgb(var(--md-shadow) / 0.30)",
        "elev-4": "0 6px 10px 4px rgb(var(--md-shadow) / 0.15), 0 2px 3px 0 rgb(var(--md-shadow) / 0.30)",
        "elev-5": "0 8px 12px 6px rgb(var(--md-shadow) / 0.15), 0 4px 4px 0 rgb(var(--md-shadow) / 0.30)",
      },
      // Material 3 motion easing sets
      transitionTimingFunction: {
        emphasized: "cubic-bezier(0.2, 0, 0, 1)",
        "emphasized-decel": "cubic-bezier(0.05, 0.7, 0.1, 1)",
        "emphasized-accel": "cubic-bezier(0.3, 0, 0.8, 0.15)",
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        "standard-decel": "cubic-bezier(0, 0, 0, 1)",
        "standard-accel": "cubic-bezier(0.3, 0, 1, 1)",
      },
      // Material 3 duration tokens
      transitionDuration: {
        "short-1": "50ms", "short-2": "100ms", "short-3": "150ms", "short-4": "200ms",
        "medium-1": "250ms", "medium-2": "300ms", "medium-3": "350ms", "medium-4": "400ms",
        "long-1": "450ms", "long-2": "500ms", "long-3": "550ms", "long-4": "600ms",
        "extra-long": "700ms",
      },
      keyframes: {
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.995)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-down": {
          "0%": { opacity: "0", transform: "translateY(-14px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "dialog-in": {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.94)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "grow-x": { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "grow-y": { "0%": { transform: "scaleY(0.4)", opacity: "0" }, "100%": { transform: "scaleY(1)", opacity: "1" } },
        "live-pulse": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgb(var(--md-primary) / 0.55)" },
          "70%": { opacity: "0.85", boxShadow: "0 0 0 7px rgb(var(--md-primary) / 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-480px 0" },
          "100%": { backgroundPosition: "480px 0" },
        },
        "flash-in": {
          "0%": { backgroundColor: "rgb(var(--md-primary-container) / 0.9)" },
          "100%": { backgroundColor: "rgb(var(--md-surface-container) / 1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-4px) rotate(6deg)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "indeterminate": {
          "0%": { transform: "translateX(-100%) scaleX(0.35)" },
          "50%": { transform: "translateX(20%) scaleX(0.55)" },
          "100%": { transform: "translateX(100%) scaleX(0.35)" },
        },
        "bar-grow": { "0%": { transform: "scaleY(0)" }, "100%": { transform: "scaleY(1)" } },
      },
      animation: {
        "page-in": "page-in var(--dur, 350ms) cubic-bezier(0.2, 0, 0, 1) both",
        "fade-in": "fade-in 300ms cubic-bezier(0.2, 0, 0, 1) both",
        "rise-in": "rise-in 500ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "slide-in-down": "slide-in-down 400ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "slide-in-left": "slide-in-left 350ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "scale-in": "scale-in 250ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "dialog-in": "dialog-in 400ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "grow-x": "grow-x 400ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "grow-y": "grow-y 450ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
        "live-pulse": "live-pulse 2s cubic-bezier(0.2, 0, 0, 1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "flash-in": "flash-in 1400ms cubic-bezier(0.2, 0, 0, 1) both",
        float: "float 3.5s ease-in-out infinite",
        "spin-slow": "spin-slow 1.4s linear infinite",
        indeterminate: "indeterminate 1.8s cubic-bezier(0.2, 0, 0, 1) infinite",
        "bar-grow": "bar-grow 700ms cubic-bezier(0.05, 0.7, 0.1, 1) both",
      },
    },
  },
  plugins: [],
};
