import { useMemo, useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { PlayerOnly } from "../auth/PlayerOnly";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatCompactMoney, formatDay, formatMoney, formatRelative } from "../lib/format";
import { chartTooltipStyle, useChartColors } from "../lib/chartColors";
import {
  Card, CardHeader, EmptyState, ErrorState, Icon, SegmentedButton, Skeleton, StatCard,
} from "../components/m3";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export default function MeBalance() {
  return <PlayerOnly>{() => <PersonalBalance />}</PlayerOnly>;
}

function PersonalBalance() {
  const realtime = useRealtime();
  const colors = useChartColors();
  const [range, setRange] = useState<"30" | "90" | "all">("30");
  const result = useAsync(() => api.meBalance(), [realtime.revision]);
  const data = result.data;

  const series = useMemo(() => {
    const all = (data?.history ?? []).map((h) => ({
      at: h.observed_at,
      label: formatDay(h.observed_at),
      amount: Number(h.amount),
    }));
    if (range === "all") return all;
    const days = Number(range);
    const cutoff = Date.now() - days * 86400000;
    return all.filter((p) => {
      const t = p.at ? Date.parse(p.at) : NaN;
      return Number.isNaN(t) ? true : t >= cutoff;
    });
  }, [data, range]);

  const latest = data?.latest ? Number(data.latest) : null;
  const first = series.length > 0 ? series[0].amount : null;
  const change = latest !== null && first !== null ? latest - first : null;
  const min = series.length ? Math.min(...series.map((p) => p.amount)) : 0;
  const max = series.length ? Math.max(...series.map((p) => p.amount)) : 1;

  return (
    <div className="space-y-4">
      {result.error && !data ? (
        <Card variant="outlined">
          <ErrorState title="Could not load your balance" description={result.error} onRetry={result.refresh} />
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Latest Balance"
          value={latest !== null ? formatCompactMoney(latest) : "–"}
          numericValue={latest ?? undefined}
          format={(n) => formatCompactMoney(n)}
          icon="wallet"
          tone="primary"
          loading={result.loading && !data}
        />
        <StatCard
          label="Change In Range"
          value={change !== null ? formatCompactMoney(change) : "–"}
          numericValue={change ?? undefined}
          format={(n) => `${n >= 0 ? "+" : ""}${formatCompactMoney(n)}`}
          icon={change !== null && change < 0 ? "trend-down" : "trend-up"}
          tone={change !== null && change < 0 ? "error" : "secondary"}
          loading={result.loading && !data}
          animationDelay={50}
        />
        <StatCard
          label="Lowest Seen"
          value={series.length ? formatCompactMoney(min) : "–"}
          numericValue={series.length ? min : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="trend-down"
          tone="neutral"
          loading={result.loading && !data}
          animationDelay={100}
        />
        <StatCard
          label="Highest Seen"
          value={series.length ? formatCompactMoney(max) : "–"}
          numericValue={series.length ? max : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="trend-up"
          tone="tertiary"
          loading={result.loading && !data}
          animationDelay={150}
        />
      </section>

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <CardHeader
            title="Balance over time"
            subtitle={
              data?.observed_at
                ? `Last seen ${formatRelative(data.observed_at)}`
                : "Every time your balance appeared in chat"
            }
            icon={<Icon name="wallet" size={20} />}
            className="mb-0 flex-1"
          />
          <SegmentedButton
            value={range}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "all", label: "All" },
            ]}
            onValueChange={setRange}
            ariaLabel="Balance range"
            size="sm"
          />
        </div>

        {result.loading && !data ? (
          <div className="px-4 pb-5 sm:px-5">
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : series.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No balance seen yet"
            description="Run /bal in-game when a tracker is connected and your balance history will build up here."
            className="py-12"
          />
        ) : (
          <div className="px-2 pb-3 sm:px-3">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.primary} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={colors.primary} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={colors.text}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: colors.grid }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  stroke={colors.text}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => formatCompactMoney(v)}
                />
                <Tooltip
                  {...chartTooltipStyle(colors)}
                  formatter={(value: number) => [formatMoney(value), "Balance"]}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={colors.primary}
                  strokeWidth={2.5}
                  fill="url(#balanceFill)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {series.length > 1 && (
        <Card>
          <CardHeader
            title="Snapshots"
            subtitle={`${series.length} observations in the selected range`}
            icon={<Icon name="clock" size={20} />}
          />
          <ul className="divide-y divide-outline-variant/40">
            {[...series].reverse().slice(0, 25).map((point, index) => (
              <li
                key={`${point.at}-${index}`}
                className="flex animate-fade-in items-center justify-between gap-3 py-2.5"
                style={{ animationDelay: `${Math.min(index * 18, 240)}ms` }}
              >
                <span className="text-xs text-on-surface-variant">
                  {point.at ? formatRelative(point.at) : "–"}
                </span>
                <span className="font-mono text-sm tabular-nums text-on-surface">
                  {formatMoney(point.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
