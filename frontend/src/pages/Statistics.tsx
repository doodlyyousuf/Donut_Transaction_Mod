import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatCompactMoney, formatCount } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Card, CardHeader, ErrorState, Icon, Skeleton, StatCard,
} from "../components/m3";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { chartTooltipStyle, useChartColors } from "../lib/chartColors";
import { SignInPrompt } from "../components/SignInPrompt";

export default function Statistics() {
  const realtime = useRealtime();
  const colors = useChartColors();
  const stats = useAsync(() => api.stats(), [realtime.revision]);

  const s = stats.data;
  const spent = Number(s?.total_money_spent ?? 0);
  const received = Number(s?.total_money_received ?? 0);
  const net = Number(s?.net ?? 0);

  const moneyData = [
    { name: "Spent", value: spent, fill: colors.error },
    { name: "Received", value: received, fill: colors.secondary },
  ];

  // Bar chart uses compact tick labels so large values stay readable.
  const summaryData = [
    { name: "Transactions", value: s?.total_transactions ?? 0, fill: colors.primary },
    { name: "Orders", value: s?.orders ?? 0, fill: colors.tertiary },
    { name: "Players", value: s?.players_observed ?? 0, fill: colors.secondary },
  ];

  return (
    <div className="space-y-6">
      <SignInPrompt />

      {stats.error && !s && (
        <Card variant="outlined">
          <ErrorState title="Could not load statistics" description={stats.error} onRetry={stats.refresh} />
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Transactions"
          value={s ? formatCount(s.total_transactions) : "–"}
          numericValue={s?.total_transactions}
          format={(n) => formatCount(Math.round(n))}
          icon="receipt"
          tone="primary"
          loading={stats.loading && !s}
        />
        <StatCard
          label="Net Position"
          value={s ? formatCompactMoney(s.net) : "–"}
          numericValue={s ? net : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="coins"
          tone={net < 0 ? "error" : "tertiary"}
          loading={stats.loading && !s}
          animationDelay={50}
        />
        <StatCard
          label="Orders"
          value={s ? formatCount(s.orders) : "–"}
          numericValue={s?.orders}
          format={(n) => formatCount(Math.round(n))}
          icon="orders"
          tone="primary"
          loading={stats.loading && !s}
          animationDelay={100}
        />
        <StatCard
          label="Unique Players"
          value={s ? formatCount(s.players_observed) : "–"}
          numericValue={s?.players_observed}
          format={(n) => formatCount(Math.round(n))}
          icon="players"
          tone="neutral"
          loading={stats.loading && !s}
          animationDelay={150}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Money flow"
          subtitle="Spent versus received, lifetime"
          icon={<Icon name="coins" size={20} />}
          loading={stats.loading && !s}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={moneyData}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={3}
                stroke="none"
                animationDuration={800}
              >
                {moneyData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Legend
                verticalAlign="bottom"
                formatter={(value) => (
                  <span style={{ color: colors.text, fontSize: 12 }}>{value}</span>
                )}
              />
              <Tooltip
                {...chartTooltipStyle(colors)}
                formatter={(value: number, name: string) => [formatCompactMoney(value), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Totals by category"
          subtitle="Counts across transactions, orders and players"
          icon={<Icon name="chart" size={20} />}
          loading={stats.loading && !s}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summaryData} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
              <XAxis dataKey="name" stroke={colors.text} fontSize={12} tickLine={false} axisLine={{ stroke: colors.grid }} />
              <YAxis stroke={colors.text} fontSize={12} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                {...chartTooltipStyle(colors)}
                cursor={{ fill: colors.grid, opacity: 0.25 }}
                formatter={(value: number) => [formatCount(value), "Count"]}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800}>
                {summaryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader
          title="Summary"
          subtitle="Read-only aggregate of everything observed so far"
          icon={<Icon name="info" size={20} />}
        />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Metric label="Total transactions" value={s ? formatCount(s.total_transactions) : "–"} />
          <Metric label="Money spent" value={s ? formatCompactMoney(s.total_money_spent) : "–"} accent="text-error" />
          <Metric label="Money received" value={s ? formatCompactMoney(s.total_money_received) : "–"} accent="text-secondary" />
          <Metric label="Net" value={s ? formatCompactMoney(s.net) : "–"} accent={net < 0 ? "text-error" : "text-secondary"} />
        </dl>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-container p-4 text-xs text-on-surface-variant">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p>
            Totals include every transaction observed by any connected tracker. Time-series
            trends require additional backend aggregation and are not shown here.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Metric({
  label, value, accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className={cn("mt-1 font-mono text-lg font-semibold tabular-nums text-on-surface", accent)}>
        {value}
      </dd>
    </div>
  );
}

function ChartCard({
  title, subtitle, icon, loading, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      {loading ? (
        <div className="flex h-[280px] items-center justify-center">
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
