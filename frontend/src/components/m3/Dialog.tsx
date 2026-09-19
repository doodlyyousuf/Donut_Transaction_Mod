import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { IconButton } from "./Button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the top-right close affordance for dialogs with explicit actions. */
  hideClose?: boolean;
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

/**
 * Material 3 dialog rendered in a portal. Handles scrim dismissal, Escape,
 * body scroll locking, focus restoration and an exit animation before unmount.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  actions,
  size = "md",
  hideClose = false,
}: DialogProps) {
  // `mounted` keeps the dialog in the tree long enough to play its exit anim.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      // Trap focus inside the panel while it is open.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      target?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [mounted, handleClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        aria-hidden
        onClick={handleClose}
        className={cn(
          "absolute inset-0 bg-scrim transition-opacity duration-200 ease-standard",
          visible ? "opacity-40" : "opacity-0"
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full rounded-t-2xl bg-surface-container-high p-6 shadow-elev-3 sm:rounded-2xl",
          "m3-scroll max-h-[92vh] overflow-y-auto",
          "transition-[opacity,transform] duration-200 ease-emphasized",
          visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 sm:translate-y-3",
          SIZES[size]
        )}
      >
        {!hideClose && (
          <div className="absolute right-3 top-3">
            <IconButton icon="close" label="Close dialog" size="sm" onClick={handleClose} />
          </div>
        )}

        {(title || description || icon) && (
          <div className="mb-5 pr-10">
            {icon && (
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-primary sm:mx-0">
                {icon}
              </div>
            )}
            <h2 className="text-xl font-medium text-on-surface sm:text-2xl">{title}</h2>
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p>
            )}
          </div>
        )}

        {children}

        {actions && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
