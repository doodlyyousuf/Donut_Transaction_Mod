import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { formatDateTime, formatRelative } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Badge, Button, Card, EmptyState, ErrorState, SegmentedButton, SkeletonRows,
} from "../components/m3";

interface Order {
  id: number;
  owner_username: string;
  item_name: string | null;
  quantity: number | null;
  fulfilled_quantity: number | null;
  remaining_quantity: number | null;
  status: string;
  created_at: string;
}

const LIMIT = 50;

function statusTone(status: string): "secondary" | "tertiary" | "error" | "neutral" {
  switch (status) {
    case "COMPLETED": return "secondary";
    case "PENDING": return "tertiary";
    case "PARTIALLY_FILLED": return "tertiary";
    case "CANCELLED": return "error";
    default: return "neutral";
  }
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function Orders() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");

  const result = useAsync(() => api.orders(page), [page]);
  const data = result.data as { total: number; items: Order[] } | null;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));

  const items = (data?.items ?? []).filter((o) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "done") return o.status === "COMPLETED" || o.status === "CANCELLED";
    return o.status !== "COMPLETED" && o.status !== "CANCELLED";
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedButton
          value={statusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "open", label: "Open" },
            { value: "done", label: "Closed" },
          ]}
          onValueChange={setStatusFilter}
          ariaLabel="Filter orders by status"
        />
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
        <Card variant="outlined">
          <ErrorState title="Could not load orders" description={result.error} onRetry={result.refresh} />
        </Card>
      ) : result.loading && !data ? (
        <Card>
          <SkeletonRows rows={6} cols={7} />
        </Card>
      ) : items.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon="orders"
            title={data?.total === 0 ? "No orders yet" : "No orders match this filter"}
            description={
              data?.total === 0
                ? "Buy orders observed in chat will be tracked here."
                : "Try switching to a different status filter."
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="m3-scroll hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-left text-xs uppercase tracking-[0.06em] text-on-surface-variant">
                  <th className="px-4 py-3 font-medium sm:px-5">ID</th>
                  <th className="px-3 py-3 font-medium">Owner</th>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Progress</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Remaining</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium sm:px-5">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order, index) => (
                  <OrderRow key={order.id} order={order} index={index} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {items.map((order, index) => (
              <OrderCard key={order.id} order={order} index={index} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-outline-variant/50 px-4 py-3 sm:px-5">
            <span className="text-xs text-on-surface-variant">
              {data ? `${data.total.toLocaleString()} orders` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outlined" size="sm" icon="chevron-left" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Prev
              </Button>
              <span className="min-w-[4.5rem] text-center text-xs text-on-surface-variant">
                Page {page} / {pages}
              </span>
              <Button variant="outlined" size="sm" trailingIcon="chevron-right" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function OrderProgress({ order }: { order: Order }) {
  const qty = order.quantity ?? 0;
  const fulfilled = order.fulfilled_quantity ?? 0;
  const pct = qty > 0 ? Math.min(100, (fulfilled / qty) * 100) : 0;

  return (
    <div className="w-28">
      <div className="mb-1 flex justify-between text-[11px] text-on-surface-variant">
        <span className="font-mono">{fulfilled}</span>
        <span className="font-mono">{qty || "–"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn(
            "h-full origin-left animate-grow-x rounded-full",
            order.status === "COMPLETED" ? "bg-secondary" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OrderRow({ order, index }: { order: Order; index: number }) {
  return (
    <tr
      className="animate-fade-in border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-on-surface/4"
      style={index < 20 ? { animationDelay: `${Math.min(index * 18, 260)}ms` } : undefined}
    >
      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant sm:px-5">#{order.id}</td>
      <td className="px-3 py-3 text-on-surface">{order.owner_username}</td>
      <td className="max-w-[14rem] truncate px-3 py-3 text-on-surface-variant">
        {order.item_name ?? <span className="italic opacity-70">unknown</span>}
      </td>
      <td className="px-3 py-3"><OrderProgress order={order} /></td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-on-surface-variant">
        {order.quantity ?? "–"}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-on-surface-variant">
        {order.remaining_quantity ?? "–"}
      </td>
      <td className="px-3 py-3">
        <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
      </td>
      <td
        className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant sm:px-5"
        title={formatDateTime(order.created_at)}
      >
        {formatRelative(order.created_at)}
      </td>
    </tr>
  );
}

function OrderCard({ order, index }: { order: Order; index: number }) {
  return (
    <div
      className="animate-slide-in-down rounded-lg bg-surface-container-low p-3"
      style={index < 12 ? { animationDelay: `${Math.min(index * 25, 220)}ms` } : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-on-surface-variant">#{order.id}</span>
        <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
      </div>
      <p className="text-sm font-medium text-on-surface">{order.owner_username}</p>
      <p className="truncate text-xs text-on-surface-variant">
        {order.item_name ?? "unknown item"}
      </p>
      <div className="mt-2"><OrderProgress order={order} /></div>
      <p className="mt-2 text-[11px] text-on-surface-variant">{formatRelative(order.created_at)}</p>
    </div>
  );
}
