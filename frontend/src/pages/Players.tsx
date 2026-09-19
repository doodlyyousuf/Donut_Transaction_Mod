import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import {
  Card, EmptyState, ErrorState, Icon, SearchField, Skeleton,
} from "../components/m3";

interface PlayerRow {
  username: string;
  observed_transactions: number;
}

/** Deterministic avatar hue from the username, so it never changes per render. */
function hueOf(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) % 360;
  }
  return hash;
}

function initials(username: string): string {
  const cleaned = username.replace(/[^A-Za-z0-9]/g, "");
  return cleaned.slice(0, 2).toUpperCase() || "??";
}

/** Mirrors the initial hash while the real skin head is loading. */
function FallbackAvatar({ username, size }: { username: string; size: number }) {
  const hue = hueOf(username);
  return (
    <span
      className="flex shrink-0 items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        borderRadius: Math.round(size * 0.28),
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 42) % 360} 58% 42%))`,
      }}
      aria-hidden
    >
      {initials(username)}
    </span>
  );
}

// Only the username is known, so use services that resolve names to skin heads.
const SKIN_PROVIDERS: ((username: string, size: number) => string)[] = [
  (username, size) => `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`,
  (username, size) => `https://minotar.net/helm/${encodeURIComponent(username)}/${size}.png`,
];

export function PlayerAvatar({ username, size = 40 }: { username: string; size?: number }) {
  const [provider, setProvider] = useState(0);
  // Ask for a slightly larger bitmap so the head stays crisp on hi-DPI screens.
  const requestSize = Math.min(256, Math.max(32, Math.round(size * 2)));

  useEffect(() => {
    setProvider(0);
  }, [username]);

  if (provider >= SKIN_PROVIDERS.length) {
    return <FallbackAvatar username={username} size={size} />;
  }

  return (
    <img
      src={SKIN_PROVIDERS[provider](username, requestSize)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setProvider((p) => p + 1)}
      className="shrink-0 bg-surface-container object-cover"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), imageRendering: "auto" }}
      aria-hidden
    />
  );
}

export default function Players() {
  const [search, setSearch] = useState("");
  const result = useAsync(() => api.players(), []);
  const players = (result.data ?? []) as PlayerRow[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? players.filter((p) => p.username.toLowerCase().includes(q))
      : players;
    return [...rows].sort((a, b) => b.observed_transactions - a.observed_transactions);
  }, [players, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          aria-label="Search players"
          containerClassName="sm:max-w-md"
        />
        <span className="text-xs text-on-surface-variant sm:ml-auto">
          {result.data ? `${filtered.length} of ${players.length} shown` : ""}
        </span>
      </div>

      {result.error && !result.data ? (
        <Card variant="outlined">
          <ErrorState title="Could not load players" description={result.error} onRetry={result.refresh} />
        </Card>
      ) : result.loading && !result.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="md">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon="players"
            title={players.length === 0 ? "No players observed" : "No players match your search"}
            description={
              players.length === 0
                ? "Players appear once their transactions are observed in game."
                : "Try a different name."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player, index) => (
            <Link
              key={player.username}
              to={`/players/${encodeURIComponent(player.username)}`}
              className="state-layer m3-elevate group flex animate-rise-in items-center gap-3 overflow-hidden rounded-xl border border-transparent bg-surface-container-low p-4 shadow-elev-1 transition-transform duration-200 ease-standard hover:-translate-y-0.5 hover:shadow-elev-2"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              <PlayerAvatar username={player.username} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">{player.username}</p>
                <p className="text-xs text-on-surface-variant">
                  {player.observed_transactions.toLocaleString()} transaction
                  {player.observed_transactions === 1 ? "" : "s"}
                </p>
              </div>
              <Icon
                name="chevron-right"
                size={20}
                className="text-on-surface-variant transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
