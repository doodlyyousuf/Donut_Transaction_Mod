import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type MeAnalytics, type MeSummary } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useSession } from "../auth/SessionProvider";
import { PlayerOnly } from "../auth/PlayerOnly";
import { useViewMode } from "../view/ViewModeProvider";
import { useRealtime } from "../realtime/RealtimeProvider";
import {
  formatCompactMoney, formatCount, formatDay, formatMoney, formatRelative, humanizeType,
} from "../lib/format";
import { cn } from "../lib/cn";
import { chartTooltipStyle, useChartColors } from "../lib/chartColors";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Icon, SegmentedButton,
  Skeleton, SkeletonRows, StatCard,
} from "../components/m3";
import { PlayerAvatar } from "./Players";
import {
  Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export default function Me() {
  return (
    <PlayerOnly>{(username) => <PersonalOverview username={username} />}</PlayerOnly>
  );
}

function PersonalOverview({ username }: { username: string }) {
  const navigate = useNavigate();
  const realtime = useRealtime();
  const { signOut } = useSession();
  const { setMode } = useViewMode();
  const colors = useChartColors();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("30");
  const days = Number(range);

  const summary = useAsync(() => api.meSummary(), [realtime.revision]);
  const analytics = useAsync(() => api.meAnalytics(days), [realtime.revision, days]);
  const txs = useAsync(
    () => api.meTransactions(new URLSearchParams({ limit: "8" })),
    [realtime.revision]
  );
  const orders = useAsync(() => api.meOrders(), [realtime.revision]);

  const s = summary.data as MeSummary | null;
  const a = analytics.data as MeAnalytics | null;

  const spent = Number(a?.totals.spent ?? 0);
  const received = Number(a?.totals.received ?? 0);
  const net = Number(a?.totals.net ?? 0);

  // Fill missing days with zero so the chart has a continuous time axis.
  const chartData = useMemo(() => {
    const byDate = new Map((a?.daily ?? []).map((d) => [d.date, d]));
    const now = new Date();
    const out: { date: string; label: string; net: number; spent: number; received: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key);
      out.push({
        date: key,
        label: formatDay(key),
        net: row ? Number(row.net) : 0,
        spent: row ? Number(row.spent) : 0,
        received: row ? Number(row.received) : 0,
      });
    }
    return out;
  }, [a, days]);

  // Momentum: this week's net against the week before.
  const trend = useMemo(() => {
    const DAY = 86400000;
    const now = Date.now();
    let recent = 0;
    let prior = 0;
    for (const d of a?.daily ?? []) {
      const t = Date.parse(`${d.date}T00:00:00Z`);
      if (Number.isNaN(t)) continue;
      const age = (now - t) / DAY;
      if (age < 7) recent += Number(d.net);
      else if (age < 14) prior += Number(d.net);
    }
    const diff = recent - prior;
    if (recent === 0 && prior === 0) return undefined;
    return {
      direction: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("flat" as const),
      label: `${diff >= 0 ? "+" : ""}${formatCompactMoney(diff)} vs prior week`,
    };
  }, [a]);

  // Items ranked by how much money they moved, so big wins and losses both show.
  const items = useMemo(() => {
    const rows = [...(a?.items ?? [])].sort(
      (x, y) => Math.abs(Number(y.net)) - Math.abs(Number(x.net))
    );
    return rows.slice(0, 8);
  }, [a]);
  const maxAbsNet = Math.max(...items.map((i) => Math.abs(Number(i.net))), 1);

  const orderRows = orders.data?.items ?? [];
  const openOrders = orderRows.filter(
    (o: any) => o.status === "PENDING" || o.status === "PARTIALLY_FILLED"
  );

  const handleSignOut = async () => {
    await signOut();
    setMode("public");
    navigate("/");
  };

  return (
    <div className="space-y-5">
      <Card animate={false}>
        <div className="flex flex-wrap items-center gap-4">
          <PlayerAvatar username={username} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-on-surface">{username}</h1>
              <Badge tone="primary" icon="lock">Personal</Badge>
            </div>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Your own spending, earnings and profit. Public leaderboards are hidden in this mode.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="text" size="sm" icon="refresh"
              onClick={() => { summary.refresh(); analytics.refresh(); txs.refresh(); orders.refresh(); }}
              loading={analytics.loading}
            >
              Refresh
            </Button>
            <Button variant="outlined" size="sm" icon="logout" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </Card>

      {analytics.error && !a ? (
        <Card variant="outlined">
          <ErrorState
            title="Could not load your analytics"
            description={analytics.error}
            onRetry={analytics.refresh}
          />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Money Spent"
              value={formatCompactMoney(a?.totals.spent ?? "0")}
              numericValue={a ? spent : undefined}
              format={(n) => formatCompactMoney(n)}
              icon="trend-down"
              tone="error"
              hint={a ? `${formatCount(a.totals.buys)} buying events` : undefined}
              loading={analytics.loading && !a}
            />
            <StatCard
              label="Money Earned"
              value={formatCompactMoney(a?.totals.received ?? "0")}
              numericValue={a ? received : undefined}
              format={(n) => formatCompactMoney(n)}
              icon="trend-up"
              tone="secondary"
              hint={a ? `${formatCount(a.totals.sells)} earning events` : undefined}
              loading={analytics.loading && !a}
              animationDelay={50}
            />
            <StatCard
              label="Net Profit / Loss"
              value={formatCompactMoney(a?.totals.net ?? "0")}
              numericValue={a ? net : undefined}
              format={(n) => formatCompactMoney(n)}
              icon="coins"
              tone={net < 0 ? "error" : "tertiary"}
              trend={trend}
              hint={
                a
                  ? net < 0 ? "Total received is below total spent" : "Total received is above total spent"
                  : undefined
              }
              loading={analytics.loading && !a}
              animationDelay={100}
            />
            <StatCard
              label="Observed Balance"
              value={s?.balance ? formatCompactMoney(s.balance) : "–"}
              numericValue={s?.balance ? Number(s.balance) : undefined}
              format={(n) => formatCompactMoney(n)}
              icon="wallet"
              tone="primary"
              hint={
                s?.balance_observed_at
                  ? `seen ${formatRelative(s.balance_observed_at)}`
                  : "never seen in chat"
              }
              loading={summary.loading && !s}
              animationDelay={150}
            />
          </section>

          <Card padding="none">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <CardHeader
                title="Profit and loss over time"
                subtitle={`Daily net for the last ${days} days`}
                icon={<Icon name="chart" size={20} />}
                className="mb-0 flex-1"
              />
              <SegmentedButton
                value={range}
                options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
                onValueChange={setRange}
                ariaLabel="Chart range"
                size="sm"
              />
            </div>
            {analytics.loading && !a ? (
              <div className="px-4 pb-5 sm:px-5">
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
            ) : (
              <div className="px-2 pb-3 sm:px-3">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                    <XAxis
                      dataKey="label"
                      stroke={colors.text}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: colors.grid }}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      stroke={colors.text}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v: number) => formatCompactMoney(v)}
                    />
                    <Tooltip
                      {...chartTooltipStyle(colors)}
                      cursor={{ fill: colors.grid, opacity: 0.2 }}
                      formatter={(value: number, name: string) => [
                        formatMoney(value),
                        name === "net" ? "Net" : name,
                      ]}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <ReferenceLine y={0} stroke={colors.outline} />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]} animationDuration={700}>
                      {chartData.map((row) => (
                        <Cell
                          key={row.date}
                          fill={row.net < 0 ? colors.error : colors.secondary}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Profit and loss by item"
                subtitle="What you bought, what you sold it for, and the difference"
                icon={<Icon name="storefront" size={20} />}
              />
              {analytics.loading && !a ? (
                <SkeletonRows rows={5} cols={2} />
              ) : items.length === 0 ? (
                <EmptyState
                  icon="storefront"
                  title="No item activity yet"
                  description="Item-level profit appears once your trades are observed."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-3.5">
                  {items.map((row, index) => {
                    const value = Number(row.net);
                    const width = (Math.abs(value) / maxAbsNet) * 100;
                    const positive = value >= 0;
                    return (
                      <li
                        key={row.item}
                        className="animate-fade-in"
                        style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
                      >
                        <div className="mb-1 flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm text-on-surface">{row.item}</span>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-sm tabular-nums",
                              positive ? "text-secondary" : "text-error"
                            )}
                            title={`spent ${formatMoney(row.spent)} - received ${formatMoney(row.received)}`}
                          >
                            {positive ? "+" : ""}{formatCompactMoney(row.net)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                          <div
                            className={cn(
                              "h-full origin-left animate-grow-x rounded-full",
                              positive ? "bg-secondary" : "bg-error"
                            )}
                            style={{ width: `${Math.max(width, 3)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {row.count} event{row.count === 1 ? "" : "s"} - spent{" "}
                          {formatCompactMoney(row.spent)}, earned {formatCompactMoney(row.received)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Your activity"
                subtitle="Most recent events that belong to you"
                icon={<Icon name="receipt" size={20} />}
                action={
                  <Button variant="text" size="sm" onClick={() => navigate("/me/transactions")}>
                    View all
                  </Button>
                }
              />
              {txs.loading && !txs.data ? (
                <SkeletonRows rows={4} cols={2} />
              ) : (txs.data?.items.length ?? 0) === 0 ? (
                <EmptyState
                  icon="receipt"
                  title="Nothing observed yet"
                  description="Your transactions appear here once a tracker sees them."
                  className="py-8"
                />
              ) : (
                <ul className="-my-1 divide-y divide-outline-variant/40">
                  {txs.data!.items.map((tx, index) => {
                    const isSpend = tx.transaction_type === "BUY"
                      || tx.transaction_type === "PAYMENT_SENT";
                    const isEarn = tx.transaction_type === "SELL"
                      || tx.transaction_type === "PAYMENT_RECEIVED"
                      || tx.transaction_type === "ORDER_DELIVERY";
                    const amount = tx.money_received ?? tx.money_paid ?? tx.total_price;
                    return (
                      <li
                        key={tx.id}
                        className="flex animate-fade-in items-center justify-between gap-3 py-2.5"
                        style={{ animationDelay: `${Math.min(index * 25, 220)}ms` }}
                      >
                        <div className="min-w-0">
                          <Badge tone={isSpend ? "error" : isEarn ? "secondary" : "neutral"}>
                            {humanizeType(tx.transaction_type)}
                          </Badge>
                          <p className="mt-1 truncate text-xs text-on-surface-variant">
                            {tx.quantity ? `${tx.quantity}x ` : ""}{tx.item_name ?? "unknown item"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "font-mono text-sm tabular-nums",
                              isSpend ? "text-error" : isEarn ? "text-secondary" : "text-on-surface"
                            )}
                          >
                            {amount ? formatMoney(amount) : "–"}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {formatRelative(tx.created_at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Open orders"
              subtitle={
                openOrders.length === 0
                  ? "No orders are waiting to be filled"
                  : `${openOrders.length} still buying`
              }
              icon={<Icon name="orders" size={20} />}
              action={
                <Button variant="text" size="sm" onClick={() => navigate("/me/orders")}>
                  All orders
                </Button>
              }
            />
            {orders.loading && !orders.data ? (
              <SkeletonRows rows={3} cols={3} />
            ) : openOrders.length === 0 ? (
              <EmptyState
                icon="orders"
                title="No open orders"
                description="Orders you create in-game appear here with their progress."
                className="py-8"
              />
            ) : (
              <ul className="space-y-4">
                {openOrders.slice(0, 5).map((o: any, index: number) => {
                  const total = o.quantity ?? 0;
                  const done = o.fulfilled_quantity ?? 0;
                  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
                  return (
                    <li
                      key={o.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="truncate text-sm text-on-surface">
                          {o.quantity ? `${o.quantity}x ` : ""}{o.item_name ?? "unknown item"}
                        </span>
                        <Badge tone={o.status === "PARTIALLY_FILLED" ? "secondary" : "neutral"}>
                          {o.status === "PARTIALLY_FILLED" ? "Partially filled" : "Pending"}
                        </Badge>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                        <div
                          className="h-full origin-left animate-grow-x rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        {done} of {total || "?"} fulfilled - created {formatRelative(o.created_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <p className="px-1 text-[11px] text-on-surface-variant">
            Everything on this page is scoped to {username}. Profit is received minus spent across
            all observed trades, which may be incomplete if a tracker was offline.
          </p>
        </>
      )}
    </div>
  );
}
