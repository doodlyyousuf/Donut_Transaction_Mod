import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Icon } from "../components/m3/Icon";
import { Button } from "../components/m3/Button";
import { Dialog } from "../components/m3/Dialog";
import { SegmentedButton } from "../components/m3/SegmentedButton";
import { useTheme } from "./ThemeProvider";
import { BACKGROUNDS, PRESETS, VARIANTS, type BackgroundStyle } from "./presets";
import type { Rgb, SchemeVariant, ThemeMode } from "./color";

const MODES: { value: ThemeMode; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { value: "system", label: "System", icon: "monitor" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

function cssRgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function ThemeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [customSeed, setCustomSeed] = useState(theme.seed);

  // Keep the custom picker in sync when the active theme changes elsewhere.
  useEffect(() => {
    setCustomSeed(theme.seed);
  }, [theme.seed]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Appearance"
      description="Every surface, container and accent is generated from one seed color, so the whole app stays in tune. Pick a preset or craft your own."
      icon={<Icon name="palette" size={26} filled />}
      size="lg"
      actions={
        <>
          <Button variant="text" onClick={theme.reset} icon="refresh">
            Reset
          </Button>
          <Button variant="filled" onClick={onClose} icon="check">
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <Section label="Mode" hint="Light, dark, or follow the system">
          <SegmentedButton
            value={theme.mode}
            options={MODES.map((m) => ({ value: m.value, label: m.label, icon: m.icon }))}
            onValueChange={(mode) => theme.setMode(mode)}
            ariaLabel="Color mode"
            fullWidth
          />
        </Section>

        <Section label="Preset theme" hint={`${PRESETS.length} accents`}>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {PRESETS.map((preset, index) => {
              const swatch = theme.swatchOf(preset);
              const active = theme.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onClick={() => theme.setPreset(preset.id)}
                  className={cn(
                    "state-layer group animate-scale-in flex flex-col items-center gap-2 rounded-2xl border p-3",
                    "transition-[border-color,background-color] duration-200 ease-standard",
                    active
                      ? "border-primary bg-primary/8"
                      : "border-outline-variant/70 hover:border-outline hover:bg-on-surface/5"
                  )}
                  style={{ animationDelay: `${index * 25}ms` }}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-transparent transition-transform duration-200 group-hover:scale-110",
                      active ? "ring-primary" : "ring-transparent"
                    )}
                    style={{ backgroundColor: cssRgb(swatch) }}
                  >
                    {active && (
                      <Icon name="check" size={18} strokeWidth={2.6} className="text-white drop-shadow" />
                    )}
                  </span>
                  <span className="text-[11px] font-medium text-on-surface">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Custom color" hint="Generate a palette from any color">
          <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/70 bg-surface-container-low p-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-outline-variant">
                <input
                  type="color"
                  value={customSeed}
                  aria-label="Custom seed color"
                  onChange={(e) => {
                    setCustomSeed(e.target.value);
                    theme.setCustom(e.target.value);
                  }}
                  className="absolute inset-0 h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 bg-transparent p-0"
                />
                <Icon name="palette" size={20} className="pointer-events-none text-white mix-blend-difference" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-on-surface">Seed color</span>
                <span className="mt-0.5 block font-mono text-xs uppercase text-on-surface-variant">
                  {customSeed}
                </span>
              </span>
            </label>

            <div className="sm:ml-auto sm:w-auto">
              <SegmentedButton
                value={theme.variant}
                options={VARIANTS.map((v) => ({ value: v.id, label: v.name }))}
                onValueChange={(variant: SchemeVariant) => theme.setCustom(customSeed, variant)}
                ariaLabel="Color scheme variant"
                size="sm"
              />
            </div>
          </div>
          {theme.isCustom && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Using a custom seed. Pick a preset above to start from a curated theme.
            </p>
          )}
        </Section>

        <Section label="Background" hint="Subtle animated backdrop">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {BACKGROUNDS.map((option) => {
              const active = theme.background === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => theme.setBackground(option.id)}
                  aria-pressed={active}
                  className={cn(
                    "state-layer group overflow-hidden rounded-2xl border p-2 text-left",
                    "transition-[border-color,background-color] duration-200",
                    active ? "border-primary bg-primary/8" : "border-outline-variant/70 hover:bg-on-surface/5"
                  )}
                >
                  <BackgroundPreview variant={option.id} />
                  <span className="mt-2 flex items-center gap-1.5 px-0.5">
                    <span className="text-[11px] font-medium text-on-surface">{option.name}</span>
                    {active && <Icon name="check" size={13} className="text-primary" strokeWidth={2.4} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="flex items-start gap-3 rounded-2xl bg-surface-container p-4 text-xs text-on-surface-variant">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p>
            Your choices are stored locally in this browser. Reduced-motion settings from your
            operating system are respected automatically, and choosing <strong>Plain</strong> disables
            the backdrop entirely.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function BackgroundPreview({ variant }: { variant: BackgroundStyle }) {
  const base = "relative h-14 w-full overflow-hidden rounded-xl bg-surface-container-high";
  const color = "rgb(var(--md-primary))";
  const tertiary = "rgb(var(--md-tertiary))";

  if (variant === "none") {
    return (
      <span className={cn(base, "grid place-items-center")}>
        <Icon name="grain" size={18} className="text-on-surface-variant" />
      </span>
    );
  }

  return (
    <span className={base}>
      <span
        className="absolute inset-0 animate-fade-in"
        style={{
          background:
            variant === "grid"
              ? `linear-gradient(rgb(var(--md-outline-variant) / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--md-outline-variant) / 0.6) 1px, transparent 1px)`
              : variant === "rainbow"
                ? "conic-gradient(from 0deg, #00d4ff, #33ff77, #ffe600, #ff8a00, #7a5cff, #00b3ff, #00d4ff)"
                : variant === "ocean"
                  ? `linear-gradient(90deg, ${color}, ${tertiary})`
                  : variant === "plasma"
                    ? `radial-gradient(circle at 20% 30%, ${color}, transparent 70%), radial-gradient(circle at 80% 70%, ${tertiary}, transparent 70%)`
                    : variant === "aurora"
                      ? `radial-gradient(ellipse at 30% 0%, ${color}, transparent 65%), radial-gradient(ellipse at 80% 100%, ${tertiary}, transparent 65%)`
                      : `linear-gradient(135deg, ${color}, ${tertiary})`,
          backgroundSize: variant === "grid" ? "16px 16px" : undefined,
          opacity: variant === "ocean" ? 0.7 : 0.85,
        }}
      />
    </span>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
          {label}
        </h3>
        {hint && <span className="text-[11px] text-on-surface-variant opacity-70">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
