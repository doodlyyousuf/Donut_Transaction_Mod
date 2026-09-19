import {
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { wsUrl, type Tx } from "../api";

interface RealtimeContextValue {
  /** Newest first, capped to avoid unbounded memory growth. */
  live: Tx[];
  connected: boolean;
  /** Increments on every received transaction; handy as a refetch dependency. */
  revision: number;
  /** Timestamp of the most recent event, for "last updated" labels. */
  lastEventAt: number | null;
  clear: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const MAX_BUFFER = 100;

/** Single shared WebSocket for the whole app, with exponential backoff. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<Tx[]>([]);
  const [connected, setConnected] = useState(false);
  const [revision, setRevision] = useState(0);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;
    let closed = false;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        delay = 1000;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg?.event === "transaction" && msg.data) {
            setLive((prev) => [msg.data as Tx, ...prev].slice(0, MAX_BUFFER));
            setRevision((r) => r + 1);
            setLastEventAt(Date.now());
          } else if (msg?.event === "balance") {
            // Balances are snapshots, so they only invalidate cached views.
            setRevision((r) => r + 1);
            setLastEventAt(Date.now());
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };

      ws.onerror = () => ws?.close();
    };

    // Defer the first connect by a tick. In development StrictMode mounts,
    // unmounts and remounts effects; deferring lets the throwaway pass cancel
    // before a socket is opened, avoiding a spurious "closed before the
    // connection is established" warning.
    const start = setTimeout(connect, 0);

    return () => {
      closed = true;
      clearTimeout(start);
      if (retry) clearTimeout(retry);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      ws?.close();
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ live, connected, revision, lastEventAt, clear: () => setLive([]) }),
    [live, connected, revision, lastEventAt]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return ctx;
}
