import { useCallback, useEffect, useState } from "react";
import {
  Badge, Button, Card, CardHeader, Chip, Icon, Switch,
} from "../components/m3";
import { ThemeDialog } from "../theme/ThemeDialog";
import { useTheme } from "../theme/ThemeProvider";
import { useRealtime } from "../realtime/RealtimeProvider";
import { api } from "../api";

type Health = "unknown" | "checking" | "ok" | "down";

export default function Settings() {
  const theme = useTheme();
  const realtime = useRealtime();
  const [themeOpen, setThemeOpen] = useState(false);
  const [compactNumbers, setCompactNumbers] = useState(true);
  const [liveAnimations, setLiveAnimations] = useState(true);
  const [health, setHealth] = useState<Health>("unknown");

  const checkBackend = useCallback(async () => {
    setHealth("checking");
    try {
      await api.health();
      setHealth("ok");
    } catch {
      setHealth("down");
    }
  }, []);

  useEffect(() => {
    void checkBackend();
  }, [checkBackend]);

  const live = realtime.connected || health === "ok";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Appearance"
          subtitle="Material 3 theme generated from a single seed color"
          icon={<Icon name="palette" size={20} />}
          action={
            <Button variant="tonal" size="sm" icon="tune" onClick={() => setThemeOpen(true)}>
              Customize
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preset" value={theme.preset.name} />
          <Field label="Mode" value={theme.mode} capitalize />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Chip selected={theme.mode === "light"} onSelectedChange={() => theme.setMode("light")} icon="sun">
            Light
          </Chip>
          <Chip selected={theme.mode === "dark"} onSelectedChange={() => theme.setMode("dark")} icon="moon">
            Dark
          </Chip>
          <Chip selected={theme.mode === "system"} onSelectedChange={() => theme.setMode("system")} icon="monitor">
            System
          </Chip>
        </div>

        <div className="mt-5 flex gap-2">
          {(["primary", "secondary", "tertiary", "error", "surface-container-high"] as const).map((role) => (
            <div key={role} className="flex-1">
              <div
                className="h-10 w-full rounded-lg border border-outline-variant/50"
                style={{ backgroundColor: `rgb(${theme.scheme[role]})` }}
              />
              <p className="mt-1 truncate text-[10px] text-on-surface-variant">{role}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Display"
          subtitle="Local preferences for this browser"
          icon={<Icon name="tune" size={20} />}
        />
        <div className="divide-y divide-outline-variant/50">
          <ToggleRow
            title="Compact money values"
            description="Abbreviate large amounts (17.8M instead of 17,800,000) in stat tiles."
            checked={compactNumbers}
            onCheckedChange={setCompactNumbers}
          />
          <ToggleRow
            title="Live animations"
            description="Pulse indicators and count-up transitions on live updates."
            checked={liveAnimations}
            onCheckedChange={setLiveAnimations}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Connection"
          subtitle="Everything updates automatically, nothing to configure"
          icon={<Icon name="wifi" size={20} />}
          action={
            <Button
              variant="text"
              size="sm"
              icon="refresh"
              onClick={() => void checkBackend()}
              disabled={health === "checking"}
            >
              Check
            </Button>
          }
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-on-surface">
              {live ? "Connected and live" : "Not connected"}
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {live
                ? "New transactions and balances appear here in real time."
                : "Trying to reach the tracker. This page retries on its own."}
            </p>
          </div>
          <Badge tone={live ? "secondary" : "error"} icon={live ? "wifi" : "wifi-off"}>
            {live ? "Live" : "Offline"}
          </Badge>
        </div>
        <div className="mt-4 space-y-3 border-t border-outline-variant/50 pt-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-on-surface-variant">Live updates</span>
            <Badge tone={realtime.connected ? "secondary" : "error"} icon={realtime.connected ? "wifi" : "wifi-off"}>
              {realtime.connected ? "Streaming" : "Paused"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-on-surface-variant">Backend</span>
            <Badge
              tone={health === "ok" ? "secondary" : health === "down" ? "error" : "primary"}
              icon={health === "ok" ? "check" : health === "down" ? "alert" : "info"}
            >
              {health === "ok" ? "Online" : health === "down" ? "Unreachable" : "Checking"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-on-surface-variant">Last activity</span>
            <span className="text-on-surface">{formatRelative(realtime.lastEventAt)}</span>
          </div>
        </div>
      </Card>

      <Card variant="filled">
        <CardHeader
          title="Privacy"
          subtitle="Your data, and nothing more"
          icon={<Icon name="eye" size={20} />}
        />
        <div className="flex items-start gap-3 rounded-xl bg-surface-container p-4">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-sm text-on-surface-variant">
            The tracker's access key stays obfuscated inside the mod and is never
            sent to this browser. To open your own private view, run
            <span className="font-mono"> /tracker link</span> in-game and enter the code.
          </p>
        </div>
      </Card>

      <Card variant="outlined">
        <CardHeader
          title="About"
          subtitle="DonutSMP Transaction Tracker"
          icon={<Icon name="sparkles" size={20} />}
        />
        <div className="space-y-1.5 text-sm text-on-surface-variant">
          <p>Version 1.0.5</p>
          <p>
            Observation-based transaction tracking for <span className="font-mono">*.donutsmp.net</span>{" "}
            servers. Data is collected passively from chat by the Fabric mod; the mod never
            performs gameplay actions.
          </p>
          <p className="pt-2 text-xs">
            Built for Minecraft 1.21.11 and 26.1.x. Theme follows Material 3 dynamic color.
          </p>
        </div>
      </Card>

      <ThemeDialog open={themeOpen} onClose={() => setThemeOpen(false)} />
    </div>
  );
}

function formatRelative(timestamp: number | null): string {
  if (!timestamp) return "No activity yet";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function Field({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-4 py-3">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-on-surface ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function ToggleRow({
  title, description, checked, onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} ariaLabel={title} />
    </div>
  );
}
