import { useTheme } from "./ThemeProvider";

/**
 * Full-viewport decorative backdrop. Colors come from the active Material
 * scheme, so the animation always matches the chosen theme. Composition,
 * motion and opacity are selected by `data-bg` (see index.css). Purely
 * decorative: hidden from assistive tech and disabled under reduced motion.
 */
export function AnimatedBackground() {
  const { background, resolvedMode } = useTheme();
  if (background === "none") return null;

  return (
    <div className="app-bg" data-bg={background} data-mode={resolvedMode} aria-hidden="true">
      <span className="app-bg__hue" />
      <span className="app-bg__blob app-bg__blob--1" />
      <span className="app-bg__blob app-bg__blob--2" />
      <span className="app-bg__blob app-bg__blob--3" />
      <span className="app-bg__beam" />
      <span className="app-bg__grid" />
      <span className="app-bg__noise" />
      <span className="app-bg__veil" />
    </div>
  );
}
