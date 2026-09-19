import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useCountUp } from "../../hooks/useCountUp";
import { Icon, type IconName } from "./Icon";

export type StatTone = "primary" | "secondary" | "tertiary" | "error" | "neutral";

const TONES: Record<StatTone, { icon: string; value: string; glow: string }> = {
  primary: {
    icon: "bg-primary/12 text-primary",
    value: "text-on-surface",
    glow: "from-primary/12",
  },
  secondary: {
    icon: "bg-secondary/14 text-secondary",
    value: "text-on-surface",
    glow: "from-secondary/12",
  },
  tertiary: {
    icon: "bg-tertiary/14 text-tertiary",
    value: "text-on-surface",
    glow: "from-tertiary/12",
  },
  error: {
    icon: "bg-error/12 text-error",
    value: "text-error",
    glow: "from-error/12",
  },
  neutral: {
    icon: "bg-surface-container-highest text-on-surface-variant",
    value: "text-on-surface",
    glow: "from-on-surface/6",
  },
};

export interface StatCardProps {
  label: string;
  /** Preformatted display value, used when no animatable number is supplied. */
  value: string;
  /** Numeric value to animate toward. */
  numericValue?: number;
  /** Formats the animated number; required for the count-up to render. */
  format?: (n: number) => string;
  icon?: IconName;
  tone?: StatTone;
  hint?: ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  loading?: boolean;
  animationDelay?: number;
}

export function StatCard({
  label,
  value,
  numericValue,
  format,
  icon,
  tone = "primary",
  hint,
  trend,
  loading = false,
  animationDelay = 0,
}: StatCardProps) {
  const animated = useCountUp(numericValue ?? 0);
  const display = numericValue !== undefined && format ? format(animated) : value;
  const tones = TONES[tone];

  if (loading) {
    return (
      <div className="m3-elevate rounded-xl border border-transparent bg-surface-container-low p-4 sm:p-5">
        <div className="mb-4 h-10 w-10 rounded-full m3-shimmer bg-surface-container-high" />
        <div className="mb-3 h-3 w-20 rounded-full bg-surface-container-high" />
        <div className="h-7 w-28 rounded-md m3-shimmer bg-surface-container-high" />
      </div>
    );
  }

  return (
    <div
      className="m3-elevate group relative animate-rise-in overflow-hidden rounded-xl border border-transparent bg-surface-container-low p-4 shadow-elev-1 hover:shadow-elev-2 sm:p-5"
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          tones.glow
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        {icon && (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", tones.icon)}>
            <Icon name={icon} size={20} />
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
              trend.direction === "up" && "bg-secondary-container text-on-secondary-container",
              trend.direction === "down" && "bg-error-container text-on-error-container",
              trend.direction === "flat" && "bg-surface-container-highest text-on-surface-variant"
            )}
          >
            {trend.direction !== "flat" && (
              <Icon name={trend.direction === "up" ? "trend-up" : "trend-down"} size={13} />
            )}
            {trend.label}
          </span>
        )}
      </div>
      <p className="relative mt-3 text-xs font-medium uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </p>
      <p className={cn("relative mt-1 text-2xl font-semibold tabular-nums sm:text-[28px]", tones.value)}>
        {display}
      </p>
      {hint && <p className="relative mt-1 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
