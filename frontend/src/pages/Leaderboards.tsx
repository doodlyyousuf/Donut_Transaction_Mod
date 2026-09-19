import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useSession } from "../auth/SessionProvider";
import { SignInPrompt } from "../components/SignInPrompt";
import { PlayerAvatar } from "./Players";
import {
  Button, Card, Chip, EmptyState, ErrorState, Icon, Skeleton,
} from "../components/m3";

const DEFAULT_CATEGORY = "money";

function rankTone(rank: number): string {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-amber-700";
  return "text-on-surface-variant";
}

function LeaderboardRow({
  rank,
  username,
  display,
  raw,
}: {
  rank: number;
  username: string;
  display: string;
  raw: string;
}) {
  return (
    <Link
      to={`/players/${encodeURIComponent(username)}`}
      className="state-layer group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-on-surface/5"
    >
      <span className={`w-8 shrink-0 text-right font-mono text-sm font-semibold ${rankTone(rank)}`}>
        {rank}
      </span>
      <PlayerAvatar username={username} size={36} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
        {username}
      </span>
      <span
        className="shrink-0 font-mono text-sm tabular-nums text-on-surface"
        title={raw}
      >
        {display}
      </span>
      <Icon
        name="chevron-right"
        size={16}
        className="shrink-0 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}

export default function Leaderboards() {
  const [params, setParams] = useSearchParams();

  const categories = useAsync(() => api.leaderboardCategories(), []);
  const categoryList = categories.data?.categories ?? [];

  const category = useMemo(() => {
    const requested = params.get("category") ?? DEFAULT_CATEGORY;
    if (categoryList.length > 0 && !categoryList.some((c) => c.id === requested)) {
      return DEFAULT_CATEGORY;
    }
    return requested;
  }, [params, categoryList]);

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const result = useAsync(
    () => api.leaderboard(category, page),
    [category, page]
  );
  // Keep the previous page's rows visible while the next page loads.
  const data = result.data;
  const entries = data?.entries ?? [];

  function selectCategory(next: string) {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.set("category", next);
      copy.set("page", "1");
      return copy;
    });
  }

  function goToPage(next: number) {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.set("page", String(Math.max(1, next)));
      return copy;
    });
  }

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {categories.loading && categoryList.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
            ))
          : categoryList.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === category}
                onSelectedChange={() => selectCategory(c.id)}
                className="shrink-0"
              >
                {c.label}
              </Chip>
            ))}
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <Icon name="trophy" size={18} className="text-primary" />
            {data?.label ?? "Leaderboard"}
          </span>
          <LeaderboardCallout />
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="text"
              size="sm"
              icon="chevron-left"
              disabled={!data?.has_prev}
              onClick={() => goToPage(page - 1)}
            >
              Prev
            </Button>
            <span className="min-w-16 text-center font-mono text-sm text-on-surface-variant">
              Page {page}
            </span>
            <Button
              variant="text"
              size="sm"
              trailingIcon="chevron-right"
              disabled={!data?.has_next}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
            <Button
              variant="text"
              size="sm"
              icon="refresh"
              loading={result.loading}
              onClick={result.refresh}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {result.error && !data ? (
        <Card variant="outlined">
          <ErrorState
            title="Could not load leaderboard"
            description={result.error}
            onRetry={result.refresh}
          />
        </Card>
      ) : result.loading && !data ? (
        <Card padding="md">
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : data?.unavailable || entries.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon="trophy"
            title={data?.unavailable ? "Leaderboard unavailable" : "No entries"}
            description={
              data?.unavailable
                ? "The upstream leaderboard is not responding right now."
                : "Try a different page or category."
            }
          />
        </Card>
      ) : (
        <Card padding="sm" className={result.loading ? "opacity-60 transition-opacity" : ""}>
          <div className="flex flex-col">
            {entries.map((entry) => (
              <LeaderboardRow
                key={`${entry.rank}-${entry.username}`}
                rank={entry.rank}
                username={entry.username}
                display={entry.display}
                raw={entry.value}
              />
            ))}
          </div>
        </Card>
      )}

      {data && entries.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outlined"
            size="sm"
            icon="chevron-left"
            disabled={!data.has_prev}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-on-surface-variant">
            {entries.length} players per page
          </span>
          <Button
            variant="outlined"
            size="sm"
            trailingIcon="chevron-right"
            disabled={!data.has_next}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Small prompt in the leaderboard header. Signed-out visitors are pointed at the
 * two ways to get their own data: sign in, or install the mod that records it.
 */
function LeaderboardCallout() {
  const { username } = useSession();

  if (!username) {
    return <SignInPrompt variant="inline" prefix="Public data." />;
  }

  return (
    <span className="text-xs text-on-surface-variant">
      Signed in as <span className="font-medium text-on-surface">{username}</span>.{" "}
      <Link to="/me" className="font-medium text-primary hover:underline">
        Open your private view
      </Link>
    </span>
  );
}

