import { useState } from "react";
import { api, type BalanceRow } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatCompactMoney, formatMoney, formatRelative } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Card, CardHeader, EmptyState, ErrorState, Icon,
  SearchField, Skeleton, StatCard,
} from "../components/m3";
import { PlayerAvatar } from "./Players";
import { SignInPrompt } from "../components/SignInPrompt";

export default function Balances() {
  const [search, setSearch] = useState("");
  const realtime = useRealtime();
  const result = useAsync(() => api.balances(), [realtime.revision]);

  const rows: BalanceRow[] = result.data?.items ?? [];
  const filtered = search.trim()
    ? rows.filter((r) => r.username.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const totalObserved = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const richest = rows[0];

  return (
    <div className="space-y-4">
      <SignInPrompt />

      <Card variant="filled" padding="md">
        <div className="flex items-start gap-3">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-on-surface-variant">
            Balances are only known at the moments they were seen in chat, so this is a
            leaderboard of <strong className="font-medium text-on-surface">observed</strong> balances
            rather than a complete one. Players who never ran <span className="font-mono">/bal</span>{" "}
            in view will not appear.
          </p>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Players Observed"
          value={result.data ? String(result.data.total) : "–"}
          numericValue={result.data?.total}
          format={(n) => Math.round(n).toLocaleString()}
          icon="players"
          tone="primary"
          loading={result.loading && !result.data}
        />
        <StatCard
          label="Combined Observed"
          value={rows.length ? formatCompactMoney(totalObserved) : "–"}
          numericValue={rows.length ? totalObserved : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="coins"
          tone="tertiary"
          loading={result.loading && !result.data}
          animationDelay={50}
        />
        <StatCard
          label="Highest Observed"
          value={richest ? formatCompactMoney(richest.amount) : "–"}
          numericValue={richest ? Number(richest.amount) : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="trend-up"
          tone="secondary"
          hint={richest?.username}
          loading={result.loading && !result.data}
          animationDelay={100}
        />
      </section>

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <CardHeader
            title="Observed balances"
            subtitle="Most recent snapshot per player"
            icon={<Icon name="wallet" size={20} />}
            className="mb-0 flex-1"
          />
          <SearchField
            placeholder="Search players"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            aria-label="Search balances"
            containerClassName="sm:max-w-xs"
          />
        </div>

        {result.error && !result.data ? (
          <ErrorState title="Could not load balances" description={result.error} onRetry={result.refresh} />
        ) : result.loading && !result.data ? (
          <div className="space-y-2 px-4 pb-4 sm:px-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="wallet"
            title={rows.length === 0 ? "No balances observed yet" : "No players match your search"}
            description={
              rows.length === 0
                ? "Balances appear when a player's balance is shown in chat while a tracker is connected."
                : "Try a different name."
            }
          />
        ) : (
          <ul className="divide-y divide-outline-variant/40">
            {filtered.map((row, index) => (
              <BalanceRowItem
                key={row.username}
                row={row}
                rank={rows.indexOf(row) + 1}
                index={index}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BalanceRowItem({ row, rank, index }: { row: BalanceRow; rank: number; index: number }) {
  const medal = rank <= 3;
  return (
    <li
      className="flex animate-fade-in items-center gap-3 px-4 py-3 transition-colors hover:bg-on-surface/4 sm:px-5"
      style={index < 20 ? { animationDelay: `${Math.min(index * 20, 260)}ms` } : undefined}
    >
      <span
        className={cn(
          "w-7 shrink-0 text-center font-mono text-sm tabular-nums",
          medal ? "font-semibold text-primary" : "text-on-surface-variant"
        )}
      >
        {rank}
      </span>
      <PlayerAvatar username={row.username} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-surface">{row.username}</p>
        <p className="text-[11px] text-on-surface-variant">
          observed {formatRelative(row.observed_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-medium tabular-nums text-on-surface">
          {formatMoney(row.amount)}
        </p>
        <p className="font-mono text-[11px] text-on-surface-variant">
          {formatCompactMoney(row.amount)}
        </p>
      </div>
    </li>
  );
}
