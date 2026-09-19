import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type FriendSummary } from "../api";
import { useAsync } from "../hooks/useAsync";
import { PlayerOnly } from "../auth/PlayerOnly";
import { useRealtime } from "../realtime/RealtimeProvider";
import { formatCompactMoney, formatCount, formatMoney, formatRelative } from "../lib/format";
import { cn } from "../lib/cn";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorState, Icon, IconButton,
  Skeleton, StatCard, TextField,
} from "../components/m3";
import { PlayerAvatar } from "./Players";

export default function MeFriends() {
  return <PlayerOnly>{(username) => <Friends me={username} />}</PlayerOnly>;
}

function Friends({ me }: { me: string }) {
  const realtime = useRealtime();
  const result = useAsync(() => api.meFriends(), [realtime.revision]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const items = result.data?.items ?? [];
  const active = items.filter((f) => f.saw_activity).length;

  const add = async () => {
    const cleaned = name.trim();
    if (!cleaned) return;
    setBusy(true);
    setError(null);
    try {
      await api.addFriend(cleaned);
      setName("");
      result.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that player.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (username: string) => {
    setRemoving(username);
    setError(null);
    try {
      await api.removeFriend(username);
      result.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that friend.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card variant="filled" padding="md">
        <div className="flex items-start gap-3">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-on-surface-variant">
            Friends are a list you keep yourself, tied to{" "}
            <strong className="font-medium text-on-surface">{me}</strong>. Adding someone
            only opens a shortcut to records trackers have already observed for them;
            it grants no access to their account.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Add a friend"
          subtitle="Enter the exact in-game username you want to follow"
          icon={<Icon name="plus" size={20} />}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <TextField
            label="Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            leadingIcon="person"
            error={Boolean(error)}
            supportingText={error ?? "Matched to the name shown in chat."}
            autoComplete="off"
            containerClassName="flex-1"
          />
          <Button
            variant="filled"
            icon="plus"
            onClick={add}
            loading={busy}
            disabled={!name.trim()}
            className="sm:mt-1"
          >
            Add friend
          </Button>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Friends"
          value={result.data ? formatCount(result.data.total) : "–"}
          numericValue={result.data?.total}
          format={(n) => formatCount(Math.round(n))}
          icon="players"
          tone="primary"
          loading={result.loading && !result.data}
        />
        <StatCard
          label="With Observed Activity"
          value={result.data ? formatCount(active) : "–"}
          numericValue={result.data ? active : undefined}
          format={(n) => formatCount(Math.round(n))}
          icon="eye"
          tone="secondary"
          loading={result.loading && !result.data}
          animationDelay={50}
        />
        <StatCard
          label="Combined Balance Seen"
          value={items.some((f) => f.balance) ? formatCompactMoney(totalBalance(items)) : "–"}
          numericValue={items.some((f) => f.balance) ? totalBalance(items) : undefined}
          format={(n) => formatCompactMoney(n)}
          icon="wallet"
          tone="tertiary"
          loading={result.loading && !result.data}
          animationDelay={100}
        />
      </section>

      {result.error && !result.data ? (
        <Card variant="outlined">
          <ErrorState
            title="Could not load your friends"
            description={result.error}
            onRetry={result.refresh}
          />
        </Card>
      ) : result.loading && !result.data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-40 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon="players"
            title="No friends yet"
            description="Add a username above to keep an eye on their observed trades, orders and balance."
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((friend, index) => (
            <FriendCard
              key={friend.username}
              friend={friend}
              index={index}
              removing={removing === friend.username}
              onRemove={() => remove(friend.username)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function totalBalance(items: FriendSummary[]): number {
  return items.reduce((sum, f) => sum + (f.balance ? Number(f.balance) : 0), 0);
}

function FriendCard({
  friend,
  index,
  removing,
  onRemove,
}: {
  friend: FriendSummary;
  index: number;
  removing: boolean;
  onRemove: () => void;
}) {
  const positive = Number(friend.net) >= 0;
  return (
    <Card
      animationDelay={index < 12 ? Math.min(index * 24, 280) : undefined}
    >
      <div className="flex items-start gap-3">
        <PlayerAvatar username={friend.username} size={42} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/players/${encodeURIComponent(friend.username)}`}
            className="truncate text-sm font-semibold text-on-surface hover:text-primary"
          >
            {friend.username}
          </Link>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            {friend.saw_activity
              ? `Last observed ${formatRelative(friend.last_observed_at)}`
              : "No activity observed yet"}
          </p>
        </div>
        <IconButton
          icon="close"
          label={`Remove ${friend.username}`}
          variant="standard"
          size="sm"
          onClick={onRemove}
          disabled={removing}
        />
      </div>

      {!friend.saw_activity ? (
        <div className="mt-3">
          <Badge tone="neutral" icon="eye">
            Awaiting data
          </Badge>
        </div>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <FriendStat label="Events" value={formatCount(friend.observed_transactions)} />
            <FriendStat label="Received" value={formatCompactMoney(friend.money_received)} tone="earn" />
            <FriendStat label="Spent" value={formatCompactMoney(friend.money_spent)} tone="spend" />
            <FriendStat
              label="Net"
              value={`${positive ? "+" : ""}${formatCompactMoney(friend.net)}`}
              tone={positive ? "earn" : "spend"}
            />
          </dl>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface-container-high px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <Icon name="wallet" size={14} />
              {friend.balance
                ? `Balance seen ${formatRelative(friend.balance_observed_at)}`
                : "No balance seen"}
            </span>
            <span
              className="font-mono text-sm tabular-nums text-on-surface"
              title={friend.balance ? formatMoney(friend.balance) : undefined}
            >
              {friend.balance ? formatCompactMoney(friend.balance) : "–"}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function FriendStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "earn" | "spend";
}) {
  return (
    <div className="rounded-lg bg-surface-container px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate font-mono text-sm tabular-nums",
          tone === "earn" && "text-secondary",
          tone === "spend" && "text-error",
          tone === "neutral" && "text-on-surface"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
