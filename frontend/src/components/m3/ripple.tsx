import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

/**
 * Material touch ripple. The event handler and the rendered layer are returned
 * separately so any shaped element (button, chip, list row, card) can opt in by
 * spreading `onPointerDown` and mounting `<RippleLayer />` inside a relatively
 * positioned, `overflow-hidden` parent.
 */
export function useRipple() {
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const nextId = useRef(0);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    // Span the largest dimension so the ripple always covers the whole shape.
    const size = Math.max(rect.width, rect.height) * 1.15;
    const id = nextId.current++;

    setRipples((prev) => [
      ...prev,
      {
        id,
        x: event.clientX - rect.left - size / 2,
        y: event.clientY - rect.top - size / 2,
        size,
      },
    ]);

    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 620);
  }, []);

  return { onPointerDown, ripples };
}

export function RippleLayer({ ripples }: { ripples: RippleItem[] }) {
  if (ripples.length === 0) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      {ripples.map((r) => (
        <span
          key={r.id}
          className="m3-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </span>
  );
}
