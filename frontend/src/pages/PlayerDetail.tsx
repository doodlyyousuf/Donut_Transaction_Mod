import { useNavigate, useParams } from "react-router-dom";
import { api, type BalanceHistory, type ExternalPlayerStats } from "../api";
import { useAsync } from "../hooks/useAsync";
import {
  counterpartyOf, formatCompactMoney, formatMoney, formatRelative, humanizeType,
} from "../lib/format";
import { cn } from "../lib/cn";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Icon,
  Skeleton, SkeletonRows, StatCard,
} from "../components/m3";
import { PlayerAvatar } from "./Players";

interface PlayerDetailData {
  username: string;
  observed_transactions: number;
  money_spent: string;
  money_received: string;
  total_volume: string;
  frequently_traded_items: { item: string; count: number }[];
  recent: {
    id: number;
    transaction_type: string;
    transaction_owner: string;
    buyer_username: string | null;
    seller_username: string | null;
    recipient_username: string | null;
    item_name: string | null;
    quantity: number | null;
    total_price: string | null;
    created_at: string;
  }[];
  note: string;
}

export default function PlayerDetail() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const observed = useAsync(() => api.player(username), [username]);
  const external = useAsync(() => api.playerDonutStats(username), [username]);
  const data = observed.data as PlayerDetailData | null;
  const stats = external.data as ExternalPlayerStats | null;

  const publicFound = stats?.found === true;
  const publicUnavailable = stats?.unavailable === true;

  // The observed-transaction endpoint 404s for players we have not seen, but
  // their public DonutSMP profile is still worth showing (e.g. when the profile
  // was opened from a leaderboard). Wait only while a lookup is still running.
  if (!data && (observed.loading || (external.loading && !stats))) {
    return <PlayerDetailSkeleton />;
  }

  if (!data && (publicFound || publicUnavailable)) {
    return (
      <PublicProfileOnly
        username={username}
        stats={stats}
        loading={external.loading}
        error={external.error}
        onBack={() => navigate(-1)}
        onRetry={() => {
          observed.refresh();
          external.refresh();
        }}
        onRefresh={external.refresh}
      />
    );
  }

  if (!data) {
    return (
      <Card variant="outlined">
        <ErrorState
          title="Player not found"
          description={`No observed transactions or public profile were found for "${username}".`}
          onRetry={() => {
            observed.refresh();
            external.refresh();
          }}
        />
      </Card>
    );
  }

  const spent = Number(data.money_spent ?? 0);
  const received = Number(data.money_received ?? 0);
  const net = received - spent;
  const topCount = data.frequently_traded_items[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" size="sm" icon="arrow-back" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button
          variant="text"
          size="sm"
          icon="refresh"
          onClick={observed.refresh}
          loading={observed.loading}
          className="sm:ml-auto"
        >
          Refresh
        </Button>
      </div>

      <Card animate={false}>
        <div className="flex items-center gap-4">
          <PlayerAvatar username={data.username} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-on-surface sm:text-2xl">
              {data.username}
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">{data.note}</p>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Transactions"
          value={data.observed_transactions.toLocaleString()}
          numericValue={data.observed_transactions}
          format={(n) => Math.round(n).toLocaleString()}
          icon="receipt"
          tone="primary"
          animationDelay={0}
        />
        <StatCard
          label="Money Spent"
          value={formatCompactMoney(data.money_spent)}
          numericValue={spent}
          format={(n) => formatCompactMoney(n)}
          icon="trend-down"
          tone="error"
          animationDelay={50}
        />
        <StatCard
          label="Money Received"
          value={formatCompactMoney(data.money_received)}
          numericValue={received}
          format={(n) => formatCompactMoney(n)}
          icon="trend-up"
          tone="secondary"
          animationDelay={100}
        />
        <StatCard
          label="Net"
          value={formatCompactMoney(net)}
          numericValue={net}
          format={(n) => formatCompactMoney(n)}
          icon="coins"
          tone={net < 0 ? "error" : "tertiary"}
          animationDelay={150}
        />
      </section>

      <BalanceCard username={data.username} />

      <DonutStatsCard
        stats={stats}
        loading={external.loading}
        error={external.error}
        onRefresh={external.refresh}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Frequently traded items"
            subtitle={`${data.frequently_traded_items.length} distinct items`}
            icon={<Icon name="storefront" size={20} />}
          />
          {data.frequently_traded_items.length === 0 ? (
            <EmptyState icon="storefront" title="No named items yet" description="Items appear once they have been parsed from chat." className="py-8" />
          ) : (
            <ul className="space-y-2.5">
              {data.frequently_traded_items.map((entry, index) => (
                <li
                  key={entry.item}
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-on-surface">{entry.item}</span>
                    <span className="shrink-0 font-mono text-xs text-on-surface-variant">
                      {entry.count}×
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-primary"
                      style={{ width: `${(entry.count / topCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent transactions"
            subtitle="Most recent 50 events"
            icon={<Icon name="clock" size={20} />}
          />
          {data.recent.length === 0 ? (
            <EmptyState icon="receipt" title="No recent activity" className="py-8" />
          ) : (
            <div className="m3-scroll max-h-[24rem] space-y-2 overflow-y-auto pr-1">
              {data.recent.map((tx, index) => {
                const isSpend = tx.transaction_type === "BUY" || tx.transaction_type === "PAYMENT_SENT";
                const isEarn = tx.transaction_type === "SELL" || tx.transaction_type === "PAYMENT_RECEIVED" || tx.transaction_type === "ORDER_DELIVERY";
                const counterparty = counterpartyOf(tx);
                return (
                  <div
                    key={tx.id}
                    className="flex animate-fade-in items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2"
                    style={{ animationDelay: `${Math.min(index * 22, 240)}ms` }}
                  >
                    <div className="min-w-0">
                      <Badge tone={isSpend ? "error" : isEarn ? "secondary" : "neutral"}>
                        {humanizeType(tx.transaction_type)}
                      </Badge>
                      <p className="mt-1 truncate text-xs text-on-surface-variant">
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
                      <p className={cn(
                        "font-mono text-sm tabular-nums",
                        isSpend ? "text-error" : isEarn ? "text-secondary" : "text-on-surface"
                      )}>
                        {tx.total_price ? formatMoney(tx.total_price) : "–"}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {formatRelative(tx.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function BalanceCard({ username }: { username: string }) {
  const result = useAsync(() => api.balance(username), [username]);
  const data = result.data as BalanceHistory | null;

  if (result.loading && !data) {
    return (
      <Card>
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-8 w-48" />
      </Card>
    );
  }

  if (result.error || !data) {
    return (
      <Card variant="outlined">
        <CardHeader
          title="Observed balance"
          subtitle="No balance snapshot has been seen for this player"
          icon={<Icon name="wallet" size={20} />}
          className="mb-0"
        />
      </Card>
    );
  }

  const amounts = data.history.map((h) => Number(h.amount));
  const max = Math.max(...amounts, 1);
  const min = Math.min(...amounts, 0);
  const span = Math.max(max - min, 1);

  return (
    <Card>
      <CardHeader
        title="Observed balance"
        subtitle={`Last seen ${formatRelative(data.observed_at)}`}
        icon={<Icon name="wallet" size={20} />}
        action={
          <Badge tone="tertiary">
            {data.history.length} snapshot{data.history.length === 1 ? "" : "s"}
          </Badge>
        }
      />
      <p className="font-mono text-2xl font-medium tabular-nums text-on-surface">
        {formatMoney(data.latest)}
      </p>
      {data.history.length > 1 && (
        <div className="mt-4 flex h-16 items-end gap-1" aria-hidden="true">
          {data.history.map((point, index) => (
            <div
              key={index}
              className="flex-1 origin-bottom animate-grow-y rounded-t-sm bg-primary/70"
              style={{
                height: `${Math.max(((Number(point.amount) - min) / span) * 100, 6)}%`,
                animationDelay: `${Math.min(index * 30, 300)}ms`,
              }}
              title={`${formatMoney(point.amount)} · ${formatRelative(point.observed_at)}`}
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-on-surface-variant">{data.note}</p>
    </Card>
  );
}

function PlayerDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><Skeleton className="mb-3 h-4 w-24" /><Skeleton className="h-7 w-28" /></Card>
        ))}
      </div>
      <Card><SkeletonRows rows={5} cols={4} /></Card>
    </div>
  );
}

/**
 * Shown when we have no observed transactions for a player but their public
 * DonutSMP profile exists (typically reached from a leaderboard).
 */
function PublicProfileOnly({
  username, stats, loading, error, onBack, onRetry, onRefresh,
}: {
  username: string;
  stats: ExternalPlayerStats | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="text" size="sm" icon="arrow-back" onClick={onBack}>
          Back
        </Button>
      </div>

      <Card animate={false}>
        <div className="flex items-center gap-4">
          <PlayerAvatar username={stats?.display_name || username} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-on-surface sm:text-2xl">
              {username}
            </h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Public DonutSMP profile - no tracker has observed this player yet.
            </p>
          </div>
        </div>
      </Card>

      <DonutStatsCard
        stats={stats}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
      />

      <Card variant="outlined">
        <CardHeader
          title="No observed transactions"
          subtitle="Only activity reported by connected trackers is recorded. The stats above come from the public donutstats.co profile."
          icon={<Icon name="info" size={20} />}
          action={
            <Button variant="text" size="sm" icon="refresh" onClick={onRetry}>
              Check again
            </Button>
          }
          className="mb-0"
        />
      </Card>
    </div>
  );
}

function DonutStatsCard({
  stats, loading, error, onRefresh,
}: {
  stats: ExternalPlayerStats | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  if (loading && !stats) {
    return (
      <Card>
        <Skeleton className="mb-4 h-4 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (stats?.unavailable) {
    return (
      <Card variant="outlined">
        <CardHeader
          title="DonutSMP profile"
          subtitle="The stats service could not be reached - try again shortly"
          icon={<Icon name="chart" size={20} />}
          action={
            <Button variant="text" size="sm" icon="refresh" onClick={onRefresh}>
              Retry
            </Button>
          }
          className="mb-0"
        />
      </Card>
    );
  }

  if (error || !stats || !stats.found) {
    return (
      <Card variant="outlined">
        <CardHeader
          title="DonutSMP profile"
          subtitle="No public profile for this player"
          icon={<Icon name="chart" size={20} />}
          className="mb-0"
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="DonutSMP profile"
        subtitle={`Public stats via ${stats.source}`}
        icon={<Icon name="chart" size={20} />}
        action={
          <Button
            variant="text"
            size="sm"
            icon="refresh"
            onClick={onRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.stats.map((stat, index) => (
          <div
            key={stat.label}
            className="animate-fade-in rounded-xl bg-surface-container-low px-4 py-3"
            style={{ animationDelay: `${Math.min(index * 35, 320)}ms` }}
          >
            <p className="truncate text-xs text-on-surface-variant" title={stat.label}>
              {stat.label}
            </p>
            <p className="mt-0.5 truncate font-mono text-lg font-medium tabular-nums text-on-surface">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
