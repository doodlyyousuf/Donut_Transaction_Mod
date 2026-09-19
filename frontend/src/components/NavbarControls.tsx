import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { useRealtime } from "../realtime/RealtimeProvider";
import { useSession } from "../auth/SessionProvider";
import { useViewMode } from "../view/ViewModeProvider";
import { useTheme } from "../theme/ThemeProvider";
import { PRESETS } from "../theme/presets";
import type { Rgb } from "../theme/color";
import { Icon } from "./m3/Icon";
import { Button, IconButton } from "./m3/Button";
import { Badge } from "./m3/Chip";
import { ViewModeSwitch } from "./ViewModeSwitch";

const rgbCss = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

/**
 * Single navbar control. Connection, view mode, theme and account all live in
 * one expandable menu so the primary navigation always has room to breathe.
 */
export function NavbarControls({ onOpenAppearance }: { onOpenAppearance: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { connected } = useRealtime();
  const { username, openSignIn, signOut } = useSession();
  const { setMode } = useViewMode();
  const theme = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Controls"
        title="Controls"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "state-layer inline-flex h-10 items-center gap-1 rounded-full border pl-1.5 pr-2",
          "transition-colors duration-200 ease-standard",
          open
            ? "border-primary/50 bg-primary/10 text-on-surface"
            : "border-outline-variant/60 bg-surface-container/70 text-on-surface-variant hover:text-on-surface"
        )}
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-full bg-primary/12 text-primary">
          <Icon name="tune" size={18} />
          <span
            className={cn(
              "absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-surface",
              connected ? "bg-primary" : "bg-error"
            )}
          />
        </span>
        <Icon
          name="chevron-down"
          size={18}
          className={cn("transition-transform duration-200 ease-emphasized", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[19rem] max-w-[calc(100vw-1.5rem)]",
            "origin-top-right animate-slide-in-down rounded-2xl border border-outline-variant/60",
            "bg-surface-container-high p-2 shadow-elev-3"
          )}
        >
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                connected ? "bg-primary/12 text-primary" : "bg-error/12 text-error"
              )}
            >
              <Icon name={connected ? "wifi" : "wifi-off"} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-on-surface">Event stream</p>
              <p className="truncate text-[11px] text-on-surface-variant">
                {connected ? "Connected, receiving events" : "Disconnected, retrying"}
              </p>
            </div>
            <Badge tone={connected ? "primary" : "error"}>{connected ? "Live" : "Off"}</Badge>
          </div>

          <div className="m3-divider my-1" />

          <div className="rounded-xl px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              View
            </p>
            <ViewModeSwitch fullWidth />
          </div>

          <div className="m3-divider my-1" />

          <div className="rounded-xl px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Accent theme
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.slice(0, 9).map((preset) => {
                const active = theme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.name}
                    aria-label={`${preset.name} theme`}
                    aria-pressed={active}
                    onClick={() => theme.setPreset(preset.id)}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform duration-150 hover:scale-110",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "ring-2 ring-on-surface ring-offset-1 ring-offset-surface-container-high"
                        : "ring-1 ring-on-surface/15"
                    )}
                    style={{ backgroundColor: rgbCss(theme.swatchOf(preset)) }}
                  />
                );
              })}
            </div>
            <Button
              variant="text"
              size="sm"
              icon="palette"
              className="mt-1 w-full justify-start"
              onClick={() => {
                setOpen(false);
                onOpenAppearance();
              }}
            >
              All appearance options
            </Button>
          </div>

          <div className="m3-divider my-1" />

          {username ? (
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                <Icon name="person" size={18} filled />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-on-surface">{username}</p>
                <p className="truncate text-[11px] text-on-surface-variant">Signed in</p>
              </div>
              <IconButton
                icon="logout"
                label="Sign out"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                  setMode("public");
                  navigate("/");
                }}
              />
            </div>
          ) : (
            <div className="p-1">
              <Button
                variant="filled"
                fullWidth
                icon="lock"
                onClick={() => {
                  setOpen(false);
                  openSignIn();
                }}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
