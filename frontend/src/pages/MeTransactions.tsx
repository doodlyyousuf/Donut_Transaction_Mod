import { useMemo, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useDebounced } from "../hooks/useDebounced";
import { PlayerOnly } from "../auth/PlayerOnly";
import { useRealtime } from "../realtime/RealtimeProvider";
import { counterpartyOf, formatMoney, formatRelative, humanizeType, transactionTone } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Badge, Button, Card, Chip, EmptyState, ErrorState, SearchField, SkeletonRows,
} from "../components/m3";
import { Pagination } from "../components/Pagination";

const FILTERS = [
  { value: "BUY", label: "Bought" },
  { value: "SELL", label: "Sold" },
  { value: "ORDER_DELIVERY", label: "Order delivery" },
  { value: "PAYMENT_SENT", label: "Sent" },
  { value: "PAYMENT_RECEIVED", label: "Received" },
  { value: "BALANCE", label: "Balance" },
];

const LIMIT = 50;

export default function MeTransactions() {
  return <PlayerOnly>{() => <PersonalTransactions />}</PlayerOnly>;
}

function PersonalTransactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [itemInput, setItemInput] = useState("");
  const item = useDebounced(itemInput, 350);
  const realtime = useRealtime();

  const bump = realtime.revision > 0 && page === 1 ? realtime.revision : 0;

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (type) params.set("type", type);
    if (item) params.set("item", item);
    return params;
  }, [page, type, item]);

  const result = useAsync(() => api.meTransactions(query), [query.toString(), bump]);
  const data = result.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));
  const hasFilters = Boolean(type || itemInput);

  const resetFilters = () => {
    setType("");
    setItemInput("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card variant="outlined" padding="md" className="space-y-4">
        <SearchField
          placeholder="Filter by item"
          value={itemInput}
          onChange={(e) => { setItemInput(e.target.value); setPage(1); }}
          onClear={() => { setItemInput(""); setPage(1); }}
          aria-label="Filter by item"
        />
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              selected={type === f.value}
              onSelectedChange={(on) => { setType(on ? f.value : ""); setPage(1); }}
            >
              {f.label}
            </Chip>
          ))}
          {hasFilters && (
            <Button variant="text" size="sm" icon="close" onClick={resetFilters}>
              Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-on-surface-variant">
            {data ? `${data.total.toLocaleString()} of your records` : ""}
          </span>
        </div>
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-base font-medium text-on-surface">Your history</h2>
          <Button
            variant="text" size="sm" icon="refresh"
            onClick={result.refresh} loading={result.loading && !!data}
          >
            Refresh
          </Button>
        </div>

        {result.error && !data ? (
          <ErrorState title="Could not load your transactions" description={result.error} onRetry={result.refresh} />
        ) : result.loading && !data ? (
          <div className="px-4 pb-4 sm:px-5">
            <SkeletonRows rows={8} cols={5} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={hasFilters ? "search" : "receipt"}
            title={hasFilters ? "No matching records" : "No history yet"}
            description={
              hasFilters
                ? "Try removing a filter or broadening your search."
                : "Your trades appear once a tracker observes them in game."
            }
            action={hasFilters ? <Button variant="tonal" onClick={resetFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {data.items.map((tx, index) => {
              const tone = transactionTone(tx.transaction_type);
              const amount = tx.money_received ?? tx.money_paid ?? tx.total_price;
              const counterparty = counterpartyOf(tx);
              return (
                <li
                  key={tx.id}
                  className="flex animate-fade-in items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-on-surface/4 sm:px-5"
                  style={index < 20 ? { animationDelay: `${Math.min(index * 18, 260)}ms` } : undefined}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone === "spend" ? "error" : tone === "earn" ? "secondary" : "neutral"}>
                        {humanizeType(tx.transaction_type)}
                      </Badge>
                      <span className="text-[11px] text-on-surface-variant">
                        {formatRelative(tx.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-on-surface">
                      {tx.quantity ? `${tx.quantity}x ` : ""}{tx.item_name ?? "unknown item"}
                    </p>
                    {counterparty && (
                      <p className="truncate text-xs text-on-surface-variant">
                        <span className="opacity-70">{counterparty.preposition} </span>
                        <span className="font-medium text-on-surface">{counterparty.username}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "font-mono text-sm tabular-nums",
                        tone === "spend" ? "text-error" : tone === "earn" ? "text-secondary" : "text-on-surface"
                      )}
                    >
                      {amount ? formatMoney(amount) : "–"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={page} pages={pages} total={data?.total ?? 0} limit={LIMIT} onPage={setPage} />
      </Card>
    </div>
  );
}
