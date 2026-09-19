import type { ReactNode } from "react";
import { useSession } from "./SessionProvider";
import { Button, Card, EmptyState, Skeleton } from "../components/m3";

/**
 * Gate for the `/me/*` routes. Handles the two states those pages share:
 * still resolving the session, and signed out. The signed-out state is a real
 * prompt rather than a redirect so a deep link explains what to do.
 */
export function PlayerOnly({ children }: { children: (username: string) => ReactNode }) {
  const { username, loading, openSignIn } = useSession();

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-7 w-28" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!username) {
    return (
      <Card variant="outlined">
        <EmptyState
          icon="lock"
          title="This view is private"
          description="Sign in with a code from /tracker link to see your own spending, earnings and profit. Nothing is shared until you do."
          action={
            <Button variant="filled" icon="lock" onClick={openSignIn}>
              Sign in
            </Button>
          }
        />
      </Card>
    );
  }

  return <>{children(username)}</>;
}
