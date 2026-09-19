import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";
import { RippleLayer, useRipple } from "./ripple";

export type ButtonVariant = "filled" | "tonal" | "elevated" | "outlined" | "text" | "error";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  filled:
    "bg-primary text-on-primary shadow-none hover:shadow-elev-1 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
  tonal:
    "bg-secondary-container text-on-secondary-container hover:shadow-elev-1 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
  elevated:
    "bg-surface-container-low text-primary shadow-elev-1 hover:shadow-elev-2 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
  outlined:
    "bg-transparent text-primary border border-outline hover:bg-primary/8 disabled:text-on-surface/38 disabled:border-on-surface/12",
  text:
    "bg-transparent text-primary hover:bg-primary/8 disabled:text-on-surface/38",
  error:
    "bg-error text-on-error hover:shadow-elev-1 disabled:bg-on-surface/12 disabled:text-on-surface/38",
};

// M3 has no small button, but dense data views need one; "sm" is 32dp.
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 min-w-8 px-3 gap-1.5 text-[13px] rounded-sm",
  md: "h-10 min-w-10 px-4 gap-2 text-sm rounded-full",
  lg: "h-12 min-w-12 px-6 gap-2.5 text-[15px] rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "filled",
    size = "md",
    icon,
    trailingIcon,
    loading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    onPointerDown,
    ...rest
  },
  ref
) {
  const ripple = useRipple();
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      onPointerDown={(event) => {
        if (!isDisabled) ripple.onPointerDown(event);
        onPointerDown?.(event);
      }}
      className={cn(
        "state-layer relative inline-flex select-none items-center justify-center overflow-hidden",
        "font-medium tracking-[0.01em] whitespace-nowrap",
        "transition-[background-color,box-shadow,color,border-color] duration-200 ease-standard",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="refresh" size={size === "sm" ? 16 : 18} className="animate-spin-slow" />
      ) : (
        icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />
      )}
      {children && <span className="truncate">{children}</span>}
      {trailingIcon && !loading && (
        <Icon name={trailingIcon} size={size === "sm" ? 16 : 18} />
      )}
      <RippleLayer ripples={ripple.ripples} />
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: "standard" | "filled" | "tonal" | "outlined";
  size?: "sm" | "md" | "lg";
  selected?: boolean;
}

const ICON_VARIANTS = {
  standard: "text-on-surface-variant hover:bg-on-surface/8",
  filled: "bg-primary text-on-primary hover:shadow-elev-1",
  tonal: "bg-secondary-container text-on-secondary-container hover:shadow-elev-1",
  outlined: "border border-outline text-on-surface-variant hover:bg-on-surface/8",
};

const ICON_SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = "standard", size = "md", selected, className, ...rest },
  ref
) {
  const ripple = useRipple();
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      onPointerDown={ripple.onPointerDown}
      className={cn(
        "state-layer relative inline-flex items-center justify-center overflow-hidden rounded-full",
        "transition-[background-color,color,box-shadow] duration-200 ease-standard",
        "disabled:pointer-events-none disabled:text-on-surface/38",
        ICON_VARIANTS[variant],
        ICON_SIZES[size],
        selected && "bg-primary/16 text-primary",
        className
      )}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 18 : size === "lg" ? 26 : 22} />
      <RippleLayer ripples={ripple.ripples} />
    </button>
  );
});
