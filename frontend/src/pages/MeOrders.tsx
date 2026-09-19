import { useMemo, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { PlayerOnly } from "../auth/PlayerOnly";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatRelative } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Icon, StatCard, SkeletonRows,
} from "../components/m3";

const STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "PARTIALLY_FILLED", label: "Partially filled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_TONE: Record<string, "primary" | "secondary" | "error" | "neutral"> = {
  PENDING: "neutral",
  PARTIALLY_FILLED: "secondary",
  COMPLETED: "primary",
  CANCELLED: "error",
};

export default function MeOrders() {
  return <PlayerOnly>{() => <PersonalOrders />}</PlayerOnly>;
}

function PersonalOrders() {
  const [status, setStatus] = useState("");
  const realtime = useRealtime();

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (status) params.set("status", status);
    return params;
  }, [status]);

  const result = useAsync(() => api.meOrders(query), [query.toString(), realtime.revision]);
  const rows: any[] = result.data?.items ?? [];

  const counts = useMemo(() => {
    const open = rows.filter((o) => o.status === "PENDING" || o.status === "PARTIALLY_FILLED");
    const completed = rows.filter((o) => o.status === "COMPLETED");
    const filled = completed.reduce((n, o) => n + (o.fulfilled_quantity ?? 0), 0);
    return { open: open.length, completed: completed.length, filled };
  }, [rows]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open Orders"
          value={String(counts.open)}
          numericValue={counts.open}
          format={(n) => String(Math.round(n))}
          icon="orders"
          tone="secondary"
          loading={result.loading && !result.data}
        />
        <StatCard
          label="Completed"
          value={String(counts.completed)}
          numericValue={counts.completed}
          format={(n) => String(Math.round(n))}
          icon="check"
          tone="primary"
          loading={result.loading && !result.data}
          animationDelay={50}
        />
        <StatCard
          label="Items Fulfilled"
          value={counts.filled.toLocaleString()}
          numericValue={counts.filled}
          format={(n) => Math.round(n).toLocaleString()}
          icon="truck"
          tone="tertiary"
          loading={result.loading && !result.data}
          animationDelay={100}
        />
        <StatCard
          label="Total Orders"
          value={String(rows.length)}
          numericValue={rows.length}
          format={(n) => String(Math.round(n))}
          icon="receipt"
          tone="neutral"
          loading={result.loading && !result.data}
          animationDelay={150}
        />
      </section>

      <Card padding="none">
        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
          <CardHeader
            title="Your orders"
            subtitle="Buy orders you created, and what has been delivered so far"
            icon={<Icon name="orders" size={20} />}
            className="mb-0 w-full sm:w-auto sm:flex-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                selected={status === s.value}
                onSelectedChange={(on) => setStatus(on ? s.value : "")}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {result.error && !result.data ? (
          <ErrorState title="Could not load your orders" description={result.error} onRetry={result.refresh} />
        ) : result.loading && !result.data ? (
          <div className="px-4 pb-4 sm:px-5">
            <SkeletonRows rows={5} cols={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="orders"
            title={status ? "No orders with that status" : "No orders yet"}
            description={
              status
                ? "Try another status filter."
                : "Orders you create in-game appear here with their fulfilment progress."
            }
            action={status ? <Button variant="tonal" onClick={() => setStatus("")}>Show all</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {rows.map((o, index) => {
              const total = o.quantity ?? 0;
              const done = o.fulfilled_quantity ?? 0;
              const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
              const tone = STATUS_TONE[o.status] ?? "neutral";
              return (
                <li
                  key={o.id}
                  className="animate-fade-in px-4 py-3.5 sm:px-5"
                  style={index < 20 ? { animationDelay: `${Math.min(index * 20, 240)}ms` } : undefined}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-on-surface">
                      {o.quantity ? `${o.quantity.toLocaleString()}x ` : ""}
                      {o.item_name ?? "unknown item"}
                    </span>
                    <Badge tone={tone}>{o.status.replace("_", " ").toLowerCase()}</Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className={cn(
                        "h-full origin-left animate-grow-x rounded-full",
                        o.status === "CANCELLED" ? "bg-error" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">
                    {done.toLocaleString()} of {total ? total.toLocaleString() : "?"} fulfilled
                    {o.remaining_quantity ? ` - ${o.remaining_quantity.toLocaleString()} remaining` : ""}
                    {" - created "}{formatRelative(o.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
