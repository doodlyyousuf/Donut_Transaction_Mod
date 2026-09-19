import {
  forwardRef, useId,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  supportingText?: ReactNode;
  error?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: ReactNode;
  containerClassName?: string;
}

/**
 * Material 3 outlined text field. The floating label uses the
 * `placeholder-shown` trick so it needs no JS state to position itself.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label, supportingText, error = false, leadingIcon, trailingIcon,
    className, containerClassName, id, ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={cn("w-full", containerClassName)}>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
            <Icon name={leadingIcon} size={20} />
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          aria-invalid={error || undefined}
          className={cn(
            "peer h-14 w-full rounded-xs border bg-transparent text-sm text-on-surface",
            "transition-[border-color,box-shadow,background-color] duration-150 ease-standard",
            "placeholder-transparent focus:outline-none",
            leadingIcon ? "pl-12" : "pl-4",
            trailingIcon ? "pr-12" : "pr-4",
            error
              ? "border-error focus:border-error focus:shadow-[inset_0_0_0_1px_rgb(var(--md-error))]"
              : "border-outline hover:border-on-surface focus:border-primary focus:shadow-[inset_0_0_0_1px_rgb(var(--md-primary))]",
            className
          )}
          {...rest}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 origin-left bg-surface px-1 text-sm",
            "transition-all duration-150 ease-standard",
            leadingIcon ? "left-11" : "left-3",
            // Floating state: focused, or has a value, or a placeholder is shown
            "peer-focus:-top-0 peer-focus:translate-y-[-50%] peer-focus:scale-[0.78]",
            "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:translate-y-[-50%] peer-[:not(:placeholder-shown)]:scale-[0.78]",
            error
              ? "text-error peer-focus:text-error"
              : "text-on-surface-variant peer-focus:text-primary"
          )}
        >
          {label}
        </label>
        {trailingIcon && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailingIcon}</span>
        )}
      </div>
      {supportingText && (
        <p className={cn("mt-1 px-4 text-xs", error ? "text-error" : "text-on-surface-variant")}>
          {supportingText}
        </p>
      )}
    </div>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  containerClassName?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, className, containerClassName, id, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className={cn("w-full", containerClassName)}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "peer h-14 w-full appearance-none rounded-xs border border-outline bg-transparent",
            "pl-4 pr-12 text-sm text-on-surface",
            "transition-[border-color,box-shadow] duration-150 ease-standard",
            "hover:border-on-surface focus:border-primary focus:outline-none",
            "focus:shadow-[inset_0_0_0_1px_rgb(var(--md-primary))]",
            // Keep the native dropdown menu legible on the current surface
            "[&>option]:bg-surface [&>option]:text-on-surface",
            className
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label
          htmlFor={selectId}
          className="pointer-events-none absolute -top-0 left-3 origin-left -translate-y-1/2 scale-[0.78] bg-surface px-1 text-sm text-on-surface-variant peer-focus:text-primary"
        >
          {label}
        </label>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <Icon name="chevron-down" size={20} />
        </span>
      </div>
    </div>
  );
});

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  onClear?: () => void;
}

/** Pill-shaped filled search input, per M3 search spec. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, containerClassName, onClear, value, ...rest },
  ref
) {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
        <Icon name="search" size={20} />
      </span>
      <input
        ref={ref}
        value={value}
        className={cn(
          "h-12 w-full rounded-full border border-transparent bg-surface-container-high pl-12 pr-11",
          "text-sm text-on-surface placeholder:text-on-surface-variant",
          "transition-[background-color,box-shadow,border-color] duration-200 ease-standard",
          "hover:bg-surface-container-highest focus:border-primary focus:bg-surface-container-low focus:outline-none",
          className
        )}
        {...rest}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="state-layer absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
});
