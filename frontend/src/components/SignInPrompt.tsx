import { useState } from "react";
import { api, type ModBuild } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useSession } from "../auth/SessionProvider";
import { cn } from "../lib/cn";
import { Button, Card, Dialog, Icon, Skeleton } from "./m3";

/** Optional external mirror for the mod. Leave empty to hide that option. */
const MOD_EXTERNAL_URL: string =
  "https://github.com/doodlyyousuf/Donut_Transaction_Mod/releases/latest";
const MOD_EXTERNAL_LABEL = "GitHub Releases";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Signed-out call to action: sign in for a private view, or install the mod that
 * records trades. Renders nothing once a player is signed in, so pages can drop
 * it in unconditionally.
 */
export function SignInPrompt({
  prefix,
  variant = "card",
  className,
}: {
  prefix?: string;
  variant?: "card" | "inline";
  className?: string;
}) {
  const { username, openSignIn } = useSession();
  const [modOpen, setModOpen] = useState(false);

  if (username) return null;

  const message = `${prefix ? `${prefix} ` : ""}Sign in to track your own trades, or install the mod to start recording.`;
  const actions = (
    <>
      <Button variant="text" size="sm" icon="lock" onClick={openSignIn}>
        Sign in
      </Button>
      <Button variant="text" size="sm" icon="download" onClick={() => setModOpen(true)}>
        Get the mod
      </Button>
    </>
  );

  return (
    <>
      {variant === "inline" ? (
        <span
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-on-surface-variant",
            className
          )}
        >
          <span>{message}</span>
          {actions}
        </span>
      ) : (
        <Card variant="filled" padding="md" className={className}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Icon name="lock" size={18} className="shrink-0 text-primary" />
            <span className="text-sm text-on-surface-variant">{message}</span>
            <span className="ml-auto flex items-center gap-1.5">{actions}</span>
          </div>
        </Card>
      )}
      <GetModDialog open={modOpen} onClose={() => setModOpen(false)} />
    </>
  );
}

function GetModDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const builds = useAsync(
    () => (open ? api.modBuilds() : Promise.resolve({ builds: [] as ModBuild[] })),
    [open]
  );
  const list = builds.data?.builds ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Get the mod"
      description="Install the Fabric mod to record your trades, then link your account."
      icon={<Icon name="download" size={22} />}
      actions={
        <Button variant="text" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-on-surface">Download from this server</p>
          {builds.loading && list.length === 0 ? (
            <Skeleton className="h-12 rounded-xl" />
          ) : list.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No builds are available right now.</p>
          ) : (
            <div className="space-y-2">
              {list.map((build) => (
                <div
                  key={build.minecraft}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface">Minecraft {build.minecraft}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      v{build.version} · {formatBytes(build.size)}
                    </p>
                  </div>
                  <Button
                    variant="tonal"
                    size="sm"
                    icon="download"
                    onClick={() => {
                      window.location.href = api.modDownloadUrl(build);
                    }}
                  >
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {MOD_EXTERNAL_URL && (
          <div>
            <p className="mb-2 text-sm font-medium text-on-surface">External site</p>
            <a
              href={MOD_EXTERNAL_URL}
              target="_blank"
              rel="noreferrer"
              className="state-layer flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2"
            >
              <span className="truncate text-sm text-primary">{MOD_EXTERNAL_LABEL}</span>
              <Icon name="open-in-new" size={18} className="shrink-0 text-on-surface-variant" />
            </a>
          </div>
        )}

        <div className="rounded-lg bg-surface-container-high p-3 text-xs text-on-surface-variant">
          <p className="mb-1 font-medium text-on-surface">After installing</p>
          <p>
            Run{" "}
            <span className="rounded bg-surface-container-highest px-1.5 py-0.5 font-mono text-on-surface">
              /tracker link
            </span>{" "}
            in-game and enter the code to open your private view.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
