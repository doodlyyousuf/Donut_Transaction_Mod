/**
 * Formatting helpers for money and time.
 *
 * Money arrives from the API as exact decimal strings (BigDecimal on the
 * backend), so it is formatted from the string itself to avoid introducing
 * floating point drift. Abbreviations are used for large values in dense
 * layouts; the exact value stays available via `title` attributes.
 */

const SUFFIXES: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Full, grouped number: 1234567.89 -> "1,234,567.89" */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const raw = typeof value === "number" ? String(value) : String(value);
  const negative = raw.startsWith("-");
  const [intPart = "0", decPart = ""] = (negative ? raw.slice(1) : raw).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = decPart.replace(/0+$/, "");
  const body = decimals ? `${grouped}.${decimals}` : grouped;
  return `${negative ? "-" : ""}$${body}`;
}

/** Compact number for stat tiles: 17800000 -> "17.8M" */
export function formatCompactMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = Number(value);
  if (!Number.isFinite(n)) return formatMoney(value);
  const negative = n < 0;
  const abs = Math.abs(n);
  for (const [threshold, suffix] of SUFFIXES) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${negative ? "-" : ""}$${scaled.toFixed(digits).replace(/\.0+$/, "")}${suffix}`;
    }
  }
  return `${negative ? "-" : ""}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Plain integer grouping for counts. */
export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "–";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString();
}

/** "14:32:07" from an ISO timestamp or an already-short minecraft time. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "–";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, { hour12: false });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Relative age such as "just now", "12m ago", "3d ago". */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value);
}

export type TransactionTone = "spend" | "earn" | "neutral" | "info";

/**
 * Which money direction a transaction type represents, so the UI colors it
 * consistently instead of scattering switch statements through components.
 */
export function transactionTone(type: string): TransactionTone {
  switch (type) {
    case "BUY":
    case "PAYMENT_SENT":
      return "spend";
    case "SELL":
    case "PAYMENT_RECEIVED":
    case "ORDER_DELIVERY":
      return "earn";
    case "LIST":
    case "AUCTION":
      return "info";
    default:
      return "neutral";
  }
}

export function humanizeType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface Counterparty {
  /** Reads correctly in "{preposition} {username}", e.g. "from Schtiev123". */
  preposition: "from" | "to";
  username: string;
}

/**
 * The other party in a transaction, when the parsed chat actually named one.
 *
 * Field meanings differ per type (see the mod's parsers): a payment puts the
 * payer in `buyer_username` and the payee in `recipient_username`, a sale puts
 * the purchaser in `buyer_username`, and a delivery puts the deliverer in
 * `seller_username`. The owner is skipped because a transaction against
 * yourself is not a counterparty. Types where the other side was never stated
 * (a local buy has no known seller, a multiple-item sell has no known buyer)
 * return null rather than guessing (§41).
 */
export function counterpartyOf(tx: {
  transaction_type: string;
  transaction_owner: string;
  buyer_username?: string | null;
  seller_username?: string | null;
  recipient_username?: string | null;
}): Counterparty | null {
  const owner = tx.transaction_owner;
  const named = (name: string | null | undefined) =>
    name && name.toLowerCase() !== owner.toLowerCase() ? name : null;

  switch (tx.transaction_type) {
    case "PAYMENT_RECEIVED": {
      const payer = named(tx.buyer_username);
      return payer ? { preposition: "from", username: payer } : null;
    }
    case "PAYMENT_SENT": {
      const payee = named(tx.recipient_username);
      return payee ? { preposition: "to", username: payee } : null;
    }
    case "SELL": {
      const purchaser = named(tx.buyer_username);
      return purchaser ? { preposition: "to", username: purchaser } : null;
    }
    case "BUY": {
      const vendor = named(tx.seller_username);
      return vendor ? { preposition: "from", username: vendor } : null;
    }
    case "ORDER_DELIVERY": {
      const deliverer = named(tx.seller_username);
      return deliverer ? { preposition: "from", username: deliverer } : null;
    }
    default:
      return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Sep 16" from an API day bucket such as "2026-09-16".
 *
 * Parsed textually rather than via `new Date()`, because a bare date string is
 * interpreted as UTC midnight and would render as the previous day for anyone
 * west of UTC.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${month} ${Number(m[3])}`;
}
