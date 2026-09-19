import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { RippleLayer, useRipple } from "./ripple";

export type CardVariant = "elevated" | "filled" | "outlined";

const CARD_VARIANTS: Record<CardVariant, string> = {
  elevated: "bg-surface-container-low shadow-elev-1 hover:shadow-elev-2 border border-transparent",
  filled: "bg-surface-container-highest shadow-none border border-transparent",
  outlined: "bg-surface shadow-none border border-outline-variant",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Animate in as it enters the viewport / mounts. */
  animate?: boolean;
  animationDelay?: number;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

export function Card({
  variant = "elevated",
  animate = true,
  animationDelay,
  padding = "md",
  className,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "m3-elevate rounded-xl",
        CARD_VARIANTS[variant],
        PADDING[padding],
        animate && "animate-rise-in",
        className
      )}
      style={{
        ...(animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface ClickableCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CardVariant;
  animate?: boolean;
  animationDelay?: number;
  children: ReactNode;
}

/** A card that is itself a button, with hover elevation and a ripple. */
export function ClickableCard({
  variant = "elevated",
  animate = true,
  animationDelay,
  className,
  children,
  onPointerDown,
  ...rest
}: ClickableCardProps) {
  const ripple = useRipple();
  return (
    <button
      onPointerDown={(e) => {
        ripple.onPointerDown(e);
        onPointerDown?.(e);
      }}
      className={cn(
        "state-layer m3-elevate relative w-full overflow-hidden rounded-xl text-left",
        "transition-transform duration-200 ease-standard hover:-translate-y-0.5",
        CARD_VARIANTS[variant],
        animate && "animate-rise-in",
        className
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
      {...rest}
    >
      <RippleLayer ripples={ripple.ripples} />
      {children}
    </button>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-on-surface">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-on-surface-variant">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
