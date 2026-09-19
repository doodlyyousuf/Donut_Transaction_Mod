import { useMemo } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatCompactMoney, formatCount, formatRelative } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Button, Card, CardHeader, ErrorState, Icon, StatCard, EmptyState, Skeleton, Spinner,
} from "../components/m3";
import { TransactionItem } from "../components/TransactionItem";
import { SignInPrompt } from "../components/SignInPrompt";

export default function Dashboard() {
  const realtime = useRealtime();
  // Refetch aggregates whenever a new transaction arrives.
  const stats = useAsync(() => api.stats(), [realtime.revision]);

  const s = stats.data;
  const spent = Number(s?.total_money_spent ?? 0);
  const received = Number(s?.total_money_received ?? 0);
  const net = Number(s?.net ?? 0);
  const flowTotal = Math.max(spent + received, 1);

  const flow = useMemo(
    () => [
      { label: "Paid", value: spent, pct: (spent / flowTotal) * 100, tone: "bg-error" },
      { label: "Received", value: received, pct: (received / flowTotal) * 100, tone: "bg-secondary" },
    ],
    [spent, received, flowTotal]
  );

  const lastEvent = realtime.lastEventAt ? new Date(realtime.lastEventAt).toISOString() : null;

  return (
    <div className="space-y-6">
      <SignInPrompt />

      {stats.error && !s && (
        <Card variant="outlined">
          <ErrorState
            title="Could not reach the backend"
            description="The API did not respond. Check that the backend service is running and try again."
            onRetry={stats.refresh}
          />
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard
          label="Total Transactions"
          value={s ? formatCount(s.total_transactions) : "–"}
          numericValue={s?.total_transactions}
          format={(n) => formatCount(Math.round(n))}
          icon="receipt"
          tone="primary"
          loading={stats.loading && !s}
          animationDelay={0}
        />
        <StatCard
          label="Total Paid (all players)"
          value={s ? formatCompactMoney(s.total_money_spent) : "–"}
          numericValue={s ? spent : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="trend-down"
          tone="error"
          loading={stats.loading && !s}
          animationDelay={40}
        />
        <StatCard
          label="Total Received (all players)"
          value={s ? formatCompactMoney(s.total_money_received) : "–"}
          numericValue={s ? received : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="trend-up"
          tone="secondary"
          loading={stats.loading && !s}
          animationDelay={80}
        />
        <StatCard
          label="Net (all players)"
          value={s ? formatCompactMoney(s.net) : "–"}
          numericValue={s ? net : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="coins"
          tone={net < 0 ? "error" : "tertiary"}
          hint="Received minus paid, summed over every player"
          loading={stats.loading && !s}
          animationDelay={120}
        />
        <StatCard
          label="Orders"
          value={s ? formatCount(s.orders) : "–"}
          numericValue={s?.orders}
          format={(n) => formatCount(Math.round(n))}
          icon="orders"
          tone="primary"
          loading={stats.loading && !s}
          animationDelay={160}
        />
        <StatCard
          label="Players Observed"
          value={s ? formatCount(s.players_observed) : "–"}
          numericValue={s?.players_observed}
          format={(n) => formatCount(Math.round(n))}
          icon="players"
          tone="neutral"
          loading={stats.loading && !s}
          animationDelay={200}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" padding="none">
          <div className="p-4 sm:p-5">
            <CardHeader
              title="Live feed"
              subtitle={
                realtime.connected
                  ? lastEvent
                    ? `Last event ${formatRelative(lastEvent)}`
                    : "Waiting for transactions"
                  : "Reconnecting to the event stream"
              }
              icon={<Icon name="bolt" size={20} />}
              action={
                <span
                  className={cn(
                    "flex h-2.5 w-2.5 rounded-full",
                    realtime.connected ? "animate-live-pulse bg-primary" : "bg-error"
                  )}
                  aria-label={realtime.connected ? "Connected" : "Disconnected"}
                />
              }
            />
            <div className="m3-scroll max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {realtime.live.length === 0 ? (
                <EmptyState
                  icon="wifi"
                  title="No live events yet"
                  description="Events appear here the moment a tracker reports them."
                  className="py-10"
                />
              ) : (
                realtime.live.map((tx, index) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    animate={index === 0}
                  />
                ))
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Money flow"
              subtitle="Lifetime totals summed over every observed player"
              icon={<Icon name="coins" size={20} />}
            />
            {stats.loading && !s ? (
              <div className="space-y-4 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ) : (
              <div className="space-y-5">
                {flow.map((row) => (
                  <div key={row.label}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm text-on-surface-variant">{row.label}</span>
                      <span className="font-mono text-sm tabular-nums text-on-surface">
                        {formatCompactMoney(row.value)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className={cn("h-full origin-left animate-grow-x rounded-full", row.tone)}
                        style={{ width: `${row.pct}%`, animationDelay: "150ms" }}
                      />
                    </div>
                  </div>
                ))}

                <div className="m3-divider my-1" />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface">Net (all players)</span>
                  <span
                    className={cn(
                      "font-mono text-lg font-semibold tabular-nums",
                      net < 0 ? "text-error" : "text-secondary"
                    )}
                  >
                    {formatCompactMoney(net)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card variant="filled">
            <CardHeader
              title="Tracker status"
              subtitle="Passive observation only, no gameplay actions"
              icon={<Icon name="wifi" size={20} />}
            />
            <div className="flex items-center justify-between rounded-lg bg-surface-container p-3">
              <div className="flex items-center gap-2 text-sm">
                {realtime.connected ? (
                  <Icon name="check" size={18} className="text-secondary" />
                ) : (
                  <Spinner size={18} className="text-error" />
                )}
                <span className="text-on-surface">
                  {realtime.connected ? "Stream connected" : "Stream disconnected"}
                </span>
              </div>
              <Button variant="text" size="sm" icon="refresh" onClick={stats.refresh}>
                Refresh
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
