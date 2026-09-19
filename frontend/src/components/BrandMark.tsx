import { Link } from "react-router-dom";
import { cn } from "../lib/cn";

/**
 * App mark: a gradient tile with a stylized donut, drawn as SVG so it inherits
 * the generated theme palette instead of shipping a fixed raster logo. It is
 * rendered exactly once - inside the top navbar's brand lockup.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl",
        "bg-gradient-to-br from-primary via-primary to-tertiary text-on-primary shadow-elev-1",
        className
      )}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(120% 120% at 20% 10%, rgb(255 255 255 / 0.45) 0%, transparent 55%)",
        }}
      />
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        className="relative"
      >
        <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="3.1" />
        <circle cx="12" cy="6.4" r="1.05" fill="currentColor" opacity="0.9" />
        <circle cx="17.2" cy="15.2" r="1.05" fill="currentColor" opacity="0.9" />
        <circle cx="6.9" cy="15.6" r="1.05" fill="currentColor" opacity="0.9" />
      </svg>
    </span>
  );
}

/**
 * Brand lockup: the single logo instance plus the wordmark, linking home. The
 * wordmark hides on very narrow screens so the navbar keeps its spacing.
 */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="DonutSMP Transaction Tracker home"
      className="state-layer group flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-2"
    >
      <BrandMark className="transition-transform duration-300 ease-emphasized group-hover:scale-105" />
      {!compact && (
        <span className="hidden flex-col leading-tight min-[380px]:flex">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-on-surface">
            DonutSMP
          </span>
          <span className="text-[11px] font-medium text-on-surface-variant">
            Transaction Tracker
          </span>
        </span>
      )}
    </Link>
  );
}
