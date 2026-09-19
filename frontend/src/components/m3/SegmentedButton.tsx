import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";
import { RippleLayer, useRipple } from "./ripple";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedButtonProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel?: string;
  fullWidth?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Material 3 segmented button. Only the first/last corners are rounded and the
 * outline is drawn per segment with -1px margins so borders collapse cleanly.
 */
export function SegmentedButton<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  fullWidth = false,
  className,
  size = "md",
}: SegmentedButtonProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-stretch", fullWidth && "w-full", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const first = index === 0;
        const last = index === options.length - 1;
        return (
          <Segment
            key={option.value}
            selected={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              first && "rounded-l-full",
              last && "rounded-r-full",
              !first && "-ml-px",
              fullWidth && "flex-1"
            )}
            size={size}
            label={option.label}
            icon={option.icon}
          />
        );
      })}
    </div>
  );
}

function Segment({
  selected, onClick, className, size, label, icon,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  size: "sm" | "md";
  label: string;
  icon?: IconName;
}) {
  const ripple = useRipple();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onPointerDown={ripple.onPointerDown}
      onClick={onClick}
      className={cn(
        "state-layer relative inline-flex items-center justify-center gap-1.5 overflow-hidden",
        "border border-outline font-medium whitespace-nowrap",
        "transition-[background-color,color,border-color] duration-200 ease-standard",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        selected
          ? "z-10 border-transparent bg-secondary-container text-on-secondary-container"
          : "bg-transparent text-on-surface-variant hover:bg-on-surface/6",
        className
      )}
    >
      {selected && <Icon name="check" size={16} strokeWidth={2.6} />}
      {!selected && icon && <Icon name={icon} size={16} />}
      <span>{label}</span>
      <RippleLayer ripples={ripple.ripples} />
    </button>
  );
}
