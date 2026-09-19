import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";
import { RippleLayer, useRipple } from "./ripple";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  selected?: boolean;
  icon?: IconName;
  avatar?: ReactNode;
  onSelectedChange?: (selected: boolean) => void;
}

/**
 * Material 3 chip. Without `selected`/`onSelectedChange` it behaves as an
 * assist chip (a plain action); with them it becomes a filter chip.
 */
export function Chip({
  selected,
  icon,
  avatar,
  children,
  className,
  onSelectedChange,
  onClick,
  ...rest
}: ChipProps) {
  const ripple = useRipple();
  const isFilter = typeof selected === "boolean";

  return (
    <button
      type="button"
      aria-pressed={isFilter ? selected : undefined}
      onPointerDown={ripple.onPointerDown}
      onClick={(e) => {
        onSelectedChange?.(!selected);
        onClick?.(e);
      }}
      className={cn(
        "state-layer relative inline-flex h-8 select-none items-center gap-1.5 overflow-hidden rounded-full",
        "px-3 text-[13px] font-medium",
        "transition-[background-color,border-color,color,box-shadow] duration-200 ease-standard",
        isFilter && selected
          ? "border border-transparent bg-secondary-container text-on-secondary-container"
          : "border border-outline-variant bg-transparent text-on-surface-variant hover:bg-on-surface/6",
        className
      )}
      {...rest}
    >
      {isFilter && selected && <Icon name="check" size={16} strokeWidth={2.6} />}
      {avatar}
      {!isFilter && icon && <Icon name={icon} size={16} />}
      {children}
      <RippleLayer ripples={ripple.ripples} />
    </button>
  );
}

/** Small non-interactive label, e.g. a transaction type badge. */
export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "secondary" | "tertiary" | "error" | "success";
  icon?: IconName;
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-container-highest text-on-surface-variant",
    primary: "bg-primary/14 text-primary",
    secondary: "bg-secondary/16 text-secondary",
    tertiary: "bg-tertiary/16 text-tertiary",
    error: "bg-error/14 text-error",
    success: "bg-secondary/16 text-secondary",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {icon && <Icon name={icon} size={13} strokeWidth={2.2} />}
      {children}
    </span>
  );
}
