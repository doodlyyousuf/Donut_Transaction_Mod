import type { Tx } from "../api";
import { cn } from "../lib/cn";
import {
  counterpartyOf, formatMoney, formatTime, humanizeType, transactionTone,
  type TransactionTone,
} from "../lib/format";
import { Icon, type IconName } from "./m3/Icon";

const TONE_STYLES: Record<TransactionTone, { chip: string; amount: string; icon: IconName }> = {
  spend: { chip: "bg-error/12 text-error", amount: "text-error", icon: "trend-down" },
  earn: { chip: "bg-secondary/16 text-secondary", amount: "text-secondary", icon: "trend-up" },
  info: { chip: "bg-tertiary/16 text-tertiary", amount: "text-on-surface-variant", icon: "storefront" },
  neutral: { chip: "bg-surface-container-highest text-on-surface-variant", amount: "text-on-surface-variant", icon: "receipt" },
};

export function TransactionItem({
  tx,
  animate = false,
  animationDelay = 0,
  showOwner = true,
}: {
  tx: Tx;
  animate?: boolean;
  animationDelay?: number;
  showOwner?: boolean;
}) {
  const tone = transactionTone(tx.transaction_type);
  const styles = TONE_STYLES[tone];
  const price = tx.total_price ? Number(tx.total_price) : null;
  const sign = tone === "spend" ? "-" : tone === "earn" ? "+" : "";
  const counterparty = counterpartyOf(tx);

  return (
    <div
      className={cn(
        "m3-elevate flex items-center gap-3 rounded-lg px-3 py-2.5",
        "bg-surface-container-low hover:bg-surface-container",
        animate && "animate-slide-in-down"
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", styles.chip)}>
        <Icon name={styles.icon} size={18} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-on-surface">
            {humanizeType(tx.transaction_type)}
          </span>
          {showOwner && tx.transaction_owner && (
            <span className="truncate text-xs text-on-surface-variant">· {tx.transaction_owner}</span>
          )}
        </div>
        <p className="truncate text-xs text-on-surface-variant">
          {tx.quantity !== null && tx.quantity !== undefined ? `${tx.quantity}× ` : ""}
          {tx.item_name ?? "(unknown item)"}
          {!tx.parsed_successfully && " · partially parsed"}
        </p>
        {counterparty && (
          <p className="truncate text-xs text-on-surface-variant">
            <span className="opacity-70">{counterparty.preposition} </span>
            <span className="font-medium text-on-surface">{counterparty.username}</span>
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("font-mono text-sm tabular-nums", styles.amount)}>
          {price === null ? "–" : `${sign}${formatMoney(tx.total_price)}`}
        </p>
        <p className="font-mono text-[11px] text-on-surface-variant">
          {formatTime(tx.minecraft_timestamp ?? tx.created_at)}
        </p>
      </div>
    </div>
  );
}
