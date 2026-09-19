import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("m3-shimmer rounded-md bg-surface-container-high", className)} aria-hidden />
  );
}

/** Placeholder rows for tables while data loads. */
export function SkeletonRows({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-1 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4", c === 0 ? "w-20" : c === cols - 1 ? "ml-auto w-16" : "w-24")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex text-primary", className)} role="status" aria-label="Loading">
      <Icon name="refresh" size={size} className="animate-spin-slow" />
    </span>
  );
}

export function LinearProgress({
  value,
  className,
  indeterminate = false,
}: {
  value?: number;
  className?: string;
  indeterminate?: boolean;
}) {
  if (indeterminate) {
    return (
      <div
        className={cn("m3-progress-track h-1 w-full rounded-full bg-primary/20", className)}
        role="progressbar"
        aria-busy="true"
      />
    );
  }
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full bg-primary/20", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-emphasized-decel"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Fixed rail across the top of the viewport, shown during any background fetch. */
export function TopProgressBar({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      {active && <div className="m3-progress-track h-full w-full bg-primary/25" />}
    </div>
  );
}

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex animate-fade-in flex-col items-center px-6 py-14 text-center", className)}>
      <span className="mb-4 flex h-16 w-16 animate-float items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="text-base font-medium text-on-surface">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex animate-fade-in flex-col items-center px-6 py-14 text-center", className)}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <Icon name="alert" size={28} />
      </span>
      <h3 className="text-base font-medium text-on-surface">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-on-surface-variant">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="state-layer mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-on-primary"
        >
          <Icon name="refresh" size={18} />
          Retry
        </button>
      )}
    </div>
  );
}
