import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { api } from "../api";

interface SessionValue {
  username: string | null;
  loading: boolean;
  signIn: (code: string) => Promise<string>;
  signOut: () => Promise<void>;
  signInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Local hint that this browser may hold a server session. The real cookie is
 * HttpOnly, so it cannot be read here; this flag only tells us whether it is
 * worth asking the API. Without it every signed-out visitor would trigger a
 * 401 on first load.
 */
const SESSION_HINT_KEY = "dtt:session";

function markSession(present: boolean) {
  try {
    if (present) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* private mode: fall back to probing only after an explicit sign-in */
  }
}

function maybeHasSession(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Tracks the signed-in player. The session itself lives in an HttpOnly cookie
 * set by the API, so the browser cannot read or tamper with it; this provider
 * only caches the username for rendering.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    // Skip the round-trip (and its expected 401) when this browser has never
    // signed in, which is the common case for public visitors.
    if (!maybeHasSession()) {
      setLoading(false);
      return;
    }
    let alive = true;
    api
      .authMe()
      .then((r) => alive && setUsername(r.username))
      .catch(() => {
        if (!alive) return;
        setUsername(null);
        markSession(false);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(async (code: string) => {
    const r = await api.linkClaim(code);
    markSession(true);
    setUsername(r.username);
    return r.username;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      markSession(false);
      setUsername(null);
    }
  }, []);

  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);

  const value = useMemo(
    () => ({ username, loading, signIn, signOut, signInOpen, openSignIn, closeSignIn }),
    [username, loading, signIn, signOut, signInOpen, openSignIn, closeSignIn]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
