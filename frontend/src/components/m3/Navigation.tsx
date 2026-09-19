import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import { BrandLockup } from "../BrandMark";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./Button";
import { RippleLayer, useRipple } from "./ripple";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/transactions", label: "Transactions", icon: "receipt" },
  { to: "/orders", label: "Orders", icon: "orders" },
  { to: "/balances", label: "Balances", icon: "wallet" },
  { to: "/players", label: "Players", icon: "players" },
  { to: "/leaderboards", label: "Leaderboards", icon: "trophy" },
  { to: "/statistics", label: "Statistics", icon: "chart" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/** The personal mode is a different destination set, not a filter on the public one. */
export const PERSONAL_NAV_ITEMS: NavItem[] = [
  { to: "/me", label: "Overview", icon: "trend-up", end: true },
  { to: "/me/transactions", label: "History", icon: "receipt" },
  { to: "/me/orders", label: "Orders", icon: "orders" },
  { to: "/me/friends", label: "Friends", icon: "players" },
  { to: "/me/balance", label: "Balance", icon: "wallet" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/** Bottom bars hold at most 5 destinations per M3; the rest live in the drawer. */
export function bottomNavItemsFor(items: NavItem[]): NavItem[] {
  return items.slice(0, 4);
}

// ------------------------------------------------------------- navbar

/** Mirrors NavLink's own matching rules so the indicator can be positioned. */
function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.end || item.to === "/") return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavBarLink({
  item,
  active,
  registerRef,
}: {
  item: NavItem;
  active: boolean;
  registerRef: (to: string, el: HTMLAnchorElement | null) => void;
}) {
  const ripple = useRipple();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      ref={(el) => registerRef(item.to, el)}
      onPointerDown={ripple.onPointerDown}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "state-layer relative z-10 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5 text-[13px]",
        "font-medium tracking-[0.01em] whitespace-nowrap",
        "transition-colors duration-200 ease-standard xl:px-3",
        active ? "text-on-secondary-container" : "text-on-surface-variant hover:text-on-surface"
      )}
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} size={18} filled={isActive} />
          <span className="hidden xl:inline">{item.label}</span>
          <RippleLayer ripples={ripple.ripples} />
        </>
      )}
    </NavLink>
  );
}

/**
 * Desktop navigation. Links sit inside a pill track and a single indicator
 * glides between them, so the active destination is legible at a glance while
 * the whole control stays compact. The track scrolls horizontally before it
 * ever wraps or crowds the brand and actions.
 */
function DesktopNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const trackRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);

  const activeItem = items.find((item) => isItemActive(pathname, item)) ?? null;
  const activeTo = activeItem?.to;

  const registerRef = (to: string, el: HTMLAnchorElement | null) => {
    if (el) linkRefs.current.set(to, el);
    else linkRefs.current.delete(to);
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const el = activeTo ? linkRefs.current.get(activeTo) : null;
      if (!el) {
        setIndicator(null);
        return;
      }
      setIndicator({ x: el.offsetLeft, width: el.offsetWidth });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    for (const el of linkRefs.current.values()) observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [activeTo, items]);

  // Bring the active destination into view when the track is scrollable. Kept
  // apart from measurement so resizing never nudges the page.
  useEffect(() => {
    if (!activeTo) return;
    linkRefs.current.get(activeTo)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTo]);

  return (
    <nav
      aria-label="Primary"
      className="no-scrollbar hidden min-w-0 flex-1 overflow-x-auto lg:flex"
    >
      <div
        ref={trackRef}
        className="relative mx-auto flex w-max items-center gap-0.5 rounded-full border border-outline-variant/50 bg-surface-container/70 p-1 backdrop-blur-sm"
      >
        {indicator && (
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 rounded-full bg-secondary-container shadow-elev-1 transition-[transform,width] duration-300 ease-emphasized"
            style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
          />
        )}
        {items.map((item) => (
          <NavBarLink
            key={item.to}
            item={item}
            active={item.to === activeTo}
            registerRef={registerRef}
          />
        ))}
      </div>
    </nav>
  );
}

export function TopNavbar({
  items,
  actions,
  onOpenMenu,
}: {
  items: NavItem[];
  actions?: ReactNode;
  onOpenMenu?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  // Swap to a more opaque, elevated surface once the page leaves the top so the
  // bar always separates cleanly from scrolled content.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-standard",
        scrolled
          ? "border-outline-variant/60 bg-surface/85 shadow-elev-1"
          : "border-outline-variant/35 bg-surface/70"
      )}
    >
      <div className="app-container flex h-16 items-center gap-3 lg:h-[70px] lg:gap-4">
        {/* Tablet widths have no bottom bar and no room for the full nav, so a
            menu button keeps every destination reachable. */}
        {onOpenMenu && (
          <span className="inline-flex lg:hidden">
            <IconButton icon="menu" label="Open navigation" onClick={onOpenMenu} />
          </span>
        )}

        <BrandLockup />

        <span className="mx-1 hidden h-6 w-px shrink-0 bg-outline-variant/60 lg:block" />

        <DesktopNav items={items} />

        {actions && (
          <div className="flex flex-1 items-center justify-end gap-0.5 lg:flex-none lg:gap-1.5">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

// ------------------------------------------------------------------- drawer

function DrawerLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const ripple = useRipple();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      onPointerDown={ripple.onPointerDown}
      className={({ isActive }) =>
        cn(
          "state-layer relative flex h-12 items-center gap-4 overflow-hidden rounded-full px-4 text-sm font-medium",
          "transition-[background-color,color] duration-200 ease-standard",
          isActive
            ? "bg-secondary-container text-on-secondary-container"
            : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={item.icon} size={22} filled={isActive} />
          <span className="truncate">{item.label}</span>
          <RippleLayer ripples={ripple.ripples} />
        </>
      )}
    </NavLink>
  );
}

export function MobileDrawer({
  open,
  onClose,
  items,
  beforeNav,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  beforeNav?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div
        className="absolute inset-0 animate-fade-in bg-scrim/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "m3-scroll absolute left-0 top-0 flex h-full w-[300px] max-w-[86vw] flex-col",
          "animate-slide-in-left overflow-y-auto rounded-r-3xl bg-surface-container-low px-3 py-4 shadow-elev-3"
        )}
      >
        <div className="mb-1 flex items-center justify-between pl-4">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Navigation
          </span>
          <IconButton icon="close" label="Close navigation" onClick={onClose} />
        </div>

        {beforeNav && <div className="mt-3 px-1">{beforeNav}</div>}

        <nav className="mt-3 space-y-1">
          {items.map((item) => (
            <DrawerLink key={item.to} item={item} onNavigate={onClose} />
          ))}
        </nav>

        {footer && <div className="mt-auto space-y-3 px-1 pt-4">{footer}</div>}
      </aside>
    </div>
  );
}

// --------------------------------------------------------------- bottom bar

export function BottomNav({
  items,
  onOpenMenu,
}: {
  items: NavItem[];
  onOpenMenu: () => void;
}) {
  return (
    <nav
      aria-label="Primary mobile"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/50 md:hidden",
        "glass"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {bottomNavItemsFor(items).map((item) => (
          <BottomNavItem key={item.to} item={item} />
        ))}
        <button
          type="button"
          onClick={onOpenMenu}
          className="state-layer relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1 text-on-surface-variant"
        >
          <span className="flex h-8 w-14 items-center justify-center rounded-full">
            <Icon name="menu" size={22} />
          </span>
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

function BottomNavItem({ item }: { item: NavItem }) {
  const ripple = useRipple();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onPointerDown={ripple.onPointerDown}
      className="state-layer relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-1 text-on-surface-variant"
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative flex h-8 w-14 items-center justify-center overflow-hidden rounded-full",
              "transition-[background-color,color] duration-300 ease-emphasized",
              isActive
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant"
            )}
          >
            <Icon name={item.icon} size={22} filled={isActive} />
            <RippleLayer ripples={ripple.ripples} />
          </span>
          <span
            className={cn(
              "max-w-[68px] truncate text-[11px] font-medium",
              isActive ? "text-on-surface" : "text-on-surface-variant"
            )}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}
