import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";
import { RippleLayer, useRipple } from "./ripple";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  icon?: IconName;
  ariaLabel?: string;
}

/** Material 3 switch. Track 52x32, thumb grows from 24dp to 28dp when on. */
export function Switch({
  checked,
  onCheckedChange,
  icon,
  ariaLabel,
  className,
  disabled,
  ...rest
}: SwitchProps) {
  const ripple = useRipple();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={ripple.onPointerDown}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "state-layer relative inline-flex h-8 w-[52px] shrink-0 items-center overflow-hidden rounded-full",
        "transition-[background-color,border-color] duration-200 ease-standard",
        "disabled:pointer-events-none disabled:opacity-40",
        checked
          ? "border-2 border-primary bg-primary text-on-primary"
          : "border-2 border-outline bg-surface-container-highest text-outline",
        className
      )}
      {...rest}
    >
      <span
        className={cn(
          "absolute left-0 flex items-center justify-center rounded-full",
          "transition-[width,height,transform,background-color,color] duration-200 ease-emphasized",
          // Track inner width is 48px (52 minus the 2px borders), so the thumb is
          // right-aligned by 48 - width.
          checked
            ? "h-6 w-6 translate-x-[24px] bg-on-primary text-primary"
            : "h-4 w-4 translate-x-[16px] bg-outline text-surface-container-highest"
        )}
      >
        {icon && checked && <Icon name={icon} size={14} strokeWidth={2.4} />}
        {icon && !checked && <Icon name={icon} size={10} strokeWidth={2.4} />}
      </span>
      <RippleLayer ripples={ripple.ripples} />
    </button>
  );
}
