import { cn } from "../../lib/cn";

/**
 * Semantic icon names used across the app. Each maps to a glyph in Google's
 * Material Symbols Rounded set, the official icon library for Material 3. The
 * indirection keeps call sites readable and lets a glyph be swapped in one
 * place without touching the pages.
 */
export type IconName =
  | "dashboard" | "receipt" | "orders" | "players" | "chart" | "settings"
  | "palette" | "menu" | "close" | "search" | "chevron-left" | "chevron-right"
  | "chevron-down" | "sun" | "moon" | "monitor" | "refresh" | "wifi" | "wifi-off"
  | "wallet" | "gavel" | "bolt" | "truck" | "check" | "plus" | "tune" | "info"
  | "alert" | "arrow-back" | "external" | "coins" | "trend-up" | "trend-down"
  | "storefront" | "clock" | "sparkles" | "shuffle" | "eye"
  | "lock" | "person" | "logout" | "trophy"
  | "history" | "shield" | "arrow-forward" | "more" | "auto-theme" | "grain"
  | "open-in-new" | "edit" | "schedule" | "groups" | "paid" | "database"
  | "download";

/** Material Symbols ligature for each semantic name. */
const GLYPHS: Record<IconName, string> = {
  dashboard: "dashboard",
  receipt: "receipt_long",
  orders: "shopping_bag",
  players: "group",
  chart: "insights",
  settings: "settings",
  palette: "palette",
  menu: "menu",
  close: "close",
  search: "search",
  "chevron-left": "chevron_left",
  "chevron-right": "chevron_right",
  "chevron-down": "expand_more",
  sun: "light_mode",
  moon: "dark_mode",
  monitor: "desktop_windows",
  refresh: "refresh",
  wifi: "wifi",
  "wifi-off": "wifi_off",
  wallet: "account_balance_wallet",
  gavel: "gavel",
  bolt: "bolt",
  truck: "local_shipping",
  check: "check",
  plus: "add",
  tune: "tune",
  info: "info",
  alert: "warning",
  "arrow-back": "arrow_back",
  external: "open_in_new",
  coins: "monetization_on",
  "trend-up": "trending_up",
  "trend-down": "trending_down",
  storefront: "storefront",
  clock: "schedule",
  sparkles: "auto_awesome",
  shuffle: "shuffle",
  eye: "visibility",
  lock: "lock",
  person: "person",
  logout: "logout",
  trophy: "emoji_events",
  history: "history",
  shield: "verified_user",
  "arrow-forward": "arrow_forward",
  more: "more_vert",
  "auto-theme": "brightness_auto",
  grain: "grain",
  "open-in-new": "open_in_new",
  edit: "edit",
  schedule: "schedule",
  groups: "groups",
  paid: "paid",
  database: "database",
  download: "download",
};

export interface IconProps {
  name: IconName;
  /** Rendered size in px. */
  size?: number;
  /**
   * Kept for backwards compatibility with the previous stroke-based set: it is
   * translated into the variable font's weight axis so bold states still read.
   */
  strokeWidth?: number;
  /** Use the filled variant (used for active/selected states). */
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function weightFor(strokeWidth: number | undefined): number {
  if (strokeWidth === undefined) return 400;
  if (strokeWidth <= 1.9) return 400;
  if (strokeWidth <= 2.2) return 500;
  if (strokeWidth <= 2.5) return 600;
  return 700;
}

/**
 * Renders a Material Symbols glyph. The font is loaded from Google Fonts and
 * exposes FILL / wght / GRAD / opsz axes, so the same glyph can be tuned for
 * weight and optical size without shipping multiple files.
 */
export function Icon({
  name,
  size = 24,
  strokeWidth,
  filled = false,
  className,
  style,
}: IconProps) {
  const weight = weightFor(strokeWidth);
  const opsz = Math.max(20, Math.min(48, Math.round(size)));
  return (
    <span
      aria-hidden="true"
      translate="no"
      className={cn("material-symbols-rounded shrink-0 leading-none", className)}
      style={{
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opsz}`,
        ...style,
      }}
    >
      {GLYPHS[name]}
    </span>
  );
}
