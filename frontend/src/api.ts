const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export interface Tx {
  id: number; transaction_type: string; transaction_owner: string; observed_by: string;
  buyer_username?: string | null; seller_username?: string | null; recipient_username?: string | null;
  item_name?: string | null; quantity?: number | null;
  total_price?: string | null; money_paid?: string | null; money_received?: string | null;
  raw_message: string; normalized_message?: string; minecraft_timestamp?: string;
  created_at: string; order_id?: number | null; parsed_successfully: boolean;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const api = {
  health: () => get<{ status: string }>("/api/health"),
  stats: () => get<any>("/api/stats"),
  transactions: (p: URLSearchParams) => get<{ total: number; items: Tx[] }>(`/api/transactions?${p}`),
  transaction: (id: number) => get<Tx>(`/api/transactions/${id}`),
  orders: () => get<any>("/api/orders"),
  players: () => get<{ username: string; observed_transactions: number }[]>("/api/players"),
  player: (u: string) => get<any>(`/api/players/${encodeURIComponent(u)}`),
};

export const wsUrl = `${BASE.replace(/^http/, "ws")}/ws/transactions`;
