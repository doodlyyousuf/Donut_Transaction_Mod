const BASE = import.meta.env.VITE_API_BASE ?? "";

export interface Tx {
  id: number; transaction_type: string; transaction_owner: string; observed_by: string;
  buyer_username?: string | null; seller_username?: string | null; recipient_username?: string | null;
  item_name?: string | null; quantity?: number | null;
  total_price?: string | null; money_paid?: string | null; money_received?: string | null;
  raw_message: string; normalized_message?: string; minecraft_timestamp?: string;
  created_at: string; order_id?: number | null; parsed_successfully: boolean;
}

// Anonymous handshake: the API gates its read endpoints behind a short-lived
// signed token bound to an HttpOnly cookie. Both are managed here so callers
// never deal with it. The cookie is set by the server; the token is cached in
// memory and refreshed just before it expires or after a 401.
let clientToken = "";
let clientTokenExpiry = 0;
let clientTokenRequest: Promise<string> | null = null;

async function requestClientToken(): Promise<string> {
  try {
    const r = await fetch(`${BASE}/api/client-token`, { credentials: "include" });
    if (!r.ok) return "";
    const data = await r.json();
    if (typeof data.token === "string") {
      clientToken = data.token;
      clientTokenExpiry = Date.now() + (Number(data.expires_in) || 300) * 1000;
    }
  } catch {
    /* offline; the request that follows will surface the failure */
  }
  return clientToken;
}

async function ensureClientToken(force = false): Promise<string> {
  if (!force && clientToken && Date.now() < clientTokenExpiry - 30_000) {
    return clientToken;
  }
  if (!clientTokenRequest) {
    clientTokenRequest = requestClientToken().finally(() => {
      clientTokenRequest = null;
    });
  }
  return clientTokenRequest;
}

function isSessionPath(path: string): boolean {
  return path.startsWith("/api/auth/") || path.startsWith("/api/me/");
}

async function get<T>(path: string): Promise<T> {
  const token = await ensureClientToken();
  const headers: Record<string, string> = token ? { "X-Client-Token": token } : {};
  let r = await fetch(`${BASE}${path}`, { headers, credentials: "include" });
  if (r.status === 401 && !isSessionPath(path)) {
    // Token may have expired mid-session; refresh once and retry.
    const fresh = await ensureClientToken(true);
    if (fresh && fresh !== token) {
      r = await fetch(`${BASE}${path}`, {
        headers: { "X-Client-Token": fresh },
        credentials: "include",
      });
    }
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const data = await r.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return r.json();
}

async function del<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!r.ok) {
    let detail = `HTTP ${r.status}`;
    try {
      const data = await r.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return r.json();
}

export interface MeSummary {
  username: string;
  observed_transactions: number;
  money_spent: string;
  money_received: string;
  net: string;
  open_orders: number;
  last_observed_at: string | null;
  balance: string | null;
  balance_observed_at: string | null;
}

export const api = {
  health: () => get<{ status: string }>("/api/health"),
  stats: () => get<any>("/api/stats"),
  transactions: (p: URLSearchParams) =>
    get<{ total: number; items: Tx[] }>(`/api/transactions?${p}`),
  transaction: (id: number) => get<Tx>(`/api/transactions/${id}`),
  orders: (page = 1) => get<any>(`/api/orders?page=${page}&limit=50`),
  players: () => get<{ username: string; observed_transactions: number }[]>("/api/players"),
  player: (u: string) => get<any>(`/api/players/${encodeURIComponent(u)}`),
  playerDonutStats: (u: string) =>
    get<ExternalPlayerStats>(`/api/players/${encodeURIComponent(u)}/donutstats`),
  leaderboardCategories: () => get<LeaderboardCategories>("/api/leaderboards"),
  leaderboard: (category: string, page = 1) =>
    get<LeaderboardPage>(`/api/leaderboards/${encodeURIComponent(category)}?page=${page}`),
  modBuilds: () => get<{ builds: ModBuild[] }>("/api/mod/builds"),
  modDownloadUrl: (build: ModBuild) => `${BASE}${build.url}`,
  balances: () => get<BalancesResponse>("/api/balances"),
  balance: (u: string) => get<BalanceHistory>(`/api/balances/${encodeURIComponent(u)}`),

  // Per-player session: a link code from `/tracker link` in-game is exchanged
  // for an HttpOnly cookie scoped to that username.
  authMe: () => get<{ username: string }>("/api/auth/me"),
  linkClaim: (code: string) =>
    post<{ username: string; expires_at: string }>("/api/auth/link/claim", { code }),
  logout: () => post<{ status: string }>("/api/auth/logout"),
  meSummary: () => get<MeSummary>("/api/me/summary"),
  meAnalytics: (days = 30) => get<MeAnalytics>(`/api/me/analytics?days=${days}`),
  meTransactions: (p: URLSearchParams) =>
    get<{ total: number; items: Tx[] }>(`/api/me/transactions?${p}`),
  meOrders: (p?: URLSearchParams) =>
    get<any>(`/api/me/orders?${p ?? new URLSearchParams({ limit: "50" })}`),
  meBalance: () => get<BalanceHistory>("/api/me/balance"),
  meFriends: () => get<FriendsResponse>("/api/me/friends"),
  addFriend: (username: string) =>
    post<FriendSummary>("/api/me/friends", { username }),
  removeFriend: (username: string) =>
    del<{ status: string; username: string }>(`/api/me/friends/${encodeURIComponent(username)}`),
};

export interface FriendSummary {
  username: string;
  observed_transactions: number;
  money_spent: string;
  money_received: string;
  net: string;
  last_observed_at: string | null;
  balance: string | null;
  balance_observed_at: string | null;
  saw_activity: boolean;
  added_at: string | null;
}

export interface FriendsResponse {
  username: string;
  total: number;
  items: FriendSummary[];
}

export interface MeAnalytics {
  username: string;
  days: number;
  totals: { spent: string; received: string; net: string; buys: number; sells: number };
  daily: { date: string; spent: string; received: string; net: string }[];
  items: { item: string; spent: string; received: string; net: string; count: number }[];
  types: { type: string; count: number; spent: string; received: string }[];
}

export interface BalanceRow {
  username: string;
  amount: string;
  observed_at: string | null;
  observed_by: string;
}

export interface BalancesResponse {
  total: number;
  items: BalanceRow[];
}

export interface BalanceHistory {
  username: string;
  latest: string;
  observed_at: string | null;
  history: { amount: string; observed_at: string | null }[];
  note: string;
}

export interface ExternalPlayerStats {
  username: string;
  display_name: string;
  found: boolean;
  unavailable?: boolean;
  source: string;
  stats: { label: string; value: string }[];
}

export interface ModBuild {
  minecraft: string;
  version: string;
  filename: string;
  size: number;
  url: string;
}

export interface LeaderboardCategory {
  id: string;
  label: string;
}

export interface LeaderboardCategories {
  source: string;
  categories: LeaderboardCategory[];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  uuid: string;
  value: string;
  display: string;
}

export interface LeaderboardPage {
  category: string;
  label: string;
  page: number;
  source: string;
  found: boolean;
  unavailable?: boolean;
  entries: LeaderboardEntry[];
  has_prev: boolean;
  has_next: boolean;
}

export const wsUrl = BASE
  ? `${BASE.replace(/^http/, "ws")}/ws/transactions`
  : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/transactions`;
