import { useMemo, useState } from "react";
import { api, type Tx } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useDebounced } from "../hooks/useDebounced";
import { useRealtime } from "../realtime/RealtimeProvider";
import { cn } from "../lib/cn";
import {
  counterpartyOf, formatMoney, formatTime, humanizeType, transactionTone,
} from "../lib/format";
import {
  Badge, Button, Card, Chip, EmptyState, ErrorState,
  SearchField, SelectField, SkeletonRows,
} from "../components/m3";
import { Pagination } from "../components/Pagination";
import { SignInPrompt } from "../components/SignInPrompt";

const TYPES = [
  { value: "", label: "All types" },
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "LIST", label: "List" },
  { value: "ORDER_DELIVERY", label: "Order delivery" },
  { value: "PAYMENT_SENT", label: "Payment sent" },
  { value: "PAYMENT_RECEIVED", label: "Payment received" },
];

const LIMIT = 50;

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [itemInput, setItemInput] = useState("");
  const realtime = useRealtime();

  // Debounce free-text filters so typing does not fire a request per keystroke.
  const player = useDebounced(playerInput, 350);
  const item = useDebounced(itemInput, 350);

  // Refetch when the page itself changes, and when a live event arrives while
  // sitting on page 1 (the newest rows shift immediately).
  const bump = realtime.revision > 0 && page === 1 ? realtime.revision : 0;

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (type) params.set("type", type);
    if (player) params.set("player", player);
    if (item) params.set("item", item);
    return params;
  }, [page, type, player, item]);

  const result = useAsync(() => api.transactions(query), [query.toString(), bump]);
  const data = result.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));

  const hasFilters = Boolean(type || playerInput || itemInput);

  const resetFilters = () => {
    setType("");
    setPlayerInput("");
    setItemInput("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <SignInPrompt />

      <Card variant="outlined" padding="md" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_220px]">
          <SearchField
            placeholder="Filter by player"
            value={playerInput}
            onChange={(e) => { setPlayerInput(e.target.value); setPage(1); }}
            onClear={() => { setPlayerInput(""); setPage(1); }}
            aria-label="Filter by player"
          />
          <SearchField
            placeholder="Filter by item"
            value={itemInput}
            onChange={(e) => { setItemInput(e.target.value); setPage(1); }}
            onClear={() => { setItemInput(""); setPage(1); }}
            aria-label="Filter by item"
          />
          <SelectField
            label="Type"
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            options={TYPES}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TYPES.filter((t) => t.value).map((t) => (
            <Chip
              key={t.value}
              selected={type === t.value}
              onSelectedChange={(on) => { setType(on ? t.value : ""); setPage(1); }}
            >
              {t.label}
            </Chip>
          ))}
          {hasFilters && (
            <Button variant="text" size="sm" icon="close" onClick={resetFilters}>
              Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-on-surface-variant">
            {data ? `${data.total.toLocaleString()} records` : ""}
          </span>
        </div>
      </Card>

      <Card padding="none" animate>
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-base font-medium text-on-surface">Results</h2>
          <Button
            variant="text"
            size="sm"
            icon="refresh"
            onClick={result.refresh}
            loading={result.loading && !!data}
          >
            Refresh
          </Button>
        </div>

        {result.error && !data ? (
          <ErrorState
            title="Could not load transactions"
            description={result.error}
            onRetry={result.refresh}
          />
        ) : result.loading && !data ? (
          <div className="px-4 pb-4 sm:px-5">
            <SkeletonRows rows={8} cols={6} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={hasFilters ? "search" : "receipt"}
            title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={
              hasFilters
                ? "Try removing a filter or broadening your search."
                : "Transactions appear as connected trackers observe them in game."
            }
            action={hasFilters ? <Button variant="tonal" onClick={resetFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="m3-scroll hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-outline-variant text-left text-xs uppercase tracking-[0.06em] text-on-surface-variant">
                    <th className="px-4 py-3 font-medium sm:px-5">Time</th>
                    <th className="px-3 py-3 font-medium">Player</th>
                    <th className="px-3 py-3 font-medium">Counterparty</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Item</th>
                    <th className="px-3 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium sm:px-5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((tx, index) => (
                    <TransactionRow key={tx.id} tx={tx} index={index} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="space-y-2 px-3 pb-3 md:hidden">
              {data.items.map((tx, index) => (
                <MobileRow key={tx.id} tx={tx} index={index} />
              ))}
            </div>
          </>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={data?.total ?? 0}
          limit={LIMIT}
          onPage={setPage}
        />
      </Card>
    </div>
  );
}

function TransactionRow({ tx, index }: { tx: Tx; index: number }) {
  const tone = transactionTone(tx.transaction_type);
  const counterparty = counterpartyOf(tx);
  return (
    <tr
      className="animate-fade-in border-b border-outline-variant/40 transition-colors duration-150 last:border-0 hover:bg-on-surface/4"
      style={index < 20 ? { animationDelay: `${Math.min(index * 18, 260)}ms` } : undefined}
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-on-surface-variant sm:px-5">
        {formatTime(tx.minecraft_timestamp ?? tx.created_at)}
      </td>
      <td className="px-3 py-3 text-on-surface">{tx.transaction_owner}</td>
      <td className="px-3 py-3">
        {counterparty ? (
          <span className="whitespace-nowrap text-on-surface-variant">
            <span className="opacity-70">{counterparty.preposition} </span>
            <span className="font-medium text-on-surface">{counterparty.username}</span>
          </span>
        ) : (
          <span className="text-on-surface-variant opacity-50">–</span>
        )}
      </td>
      <td className="px-3 py-3">
        <Badge tone={tone === "spend" ? "error" : tone === "earn" ? "secondary" : "neutral"}>
          {humanizeType(tx.transaction_type)}
        </Badge>
      </td>
      <td className="max-w-[16rem] truncate px-3 py-3 text-on-surface-variant">
        {tx.item_name ?? <span className="italic opacity-70">unknown</span>}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-on-surface-variant">
        {tx.quantity ?? "–"}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums sm:px-5",
          tone === "spend" ? "text-error" : tone === "earn" ? "text-secondary" : "text-on-surface"
        )}
      >
        {tx.total_price ? formatMoney(tx.total_price) : "–"}
      </td>
    </tr>
  );
}

function MobileRow({ tx, index }: { tx: Tx; index: number }) {
  const tone = transactionTone(tx.transaction_type);
  const counterparty = counterpartyOf(tx);
  return (
    <div
      className="animate-slide-in-down rounded-lg bg-surface-container-low p-3"
      style={index < 12 ? { animationDelay: `${Math.min(index * 25, 220)}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge tone={tone === "spend" ? "error" : tone === "earn" ? "secondary" : "neutral"}>
            {humanizeType(tx.transaction_type)}
          </Badge>
          <p className="mt-1.5 truncate text-sm text-on-surface">{tx.transaction_owner}</p>
          <p className="truncate text-xs text-on-surface-variant">
            {tx.quantity ? `${tx.quantity}× ` : ""}
            {tx.item_name ?? "unknown item"}
          </p>
          {counterparty && (
            <p className="truncate text-xs text-on-surface-variant">
              <span className="opacity-70">{counterparty.preposition} </span>
              <span className="font-medium text-on-surface">{counterparty.username}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-mono text-sm tabular-nums", tone === "spend" ? "text-error" : tone === "earn" ? "text-secondary" : "text-on-surface")}>
            {tx.total_price ? formatMoney(tx.total_price) : "–"}
          </p>
          <p className="font-mono text-[11px] text-on-surface-variant">
            {formatTime(tx.minecraft_timestamp ?? tx.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
