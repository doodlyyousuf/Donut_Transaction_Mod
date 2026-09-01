import { useEffect, useState } from "react";
import { api } from "../api";
import { useTransactionsSocket } from "../hooks/useTransactionsSocket";

const card = "bg-slate-800 rounded-xl p-5 border border-slate-700";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const { live, connected } = useTransactionsSocket();

  useEffect(() => { api.stats().then(setStats).catch(() => {}); }, [live.length]);

  const money = (v: any) => `$${Number(v ?? 0).toLocaleString()}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Transaction Tracker</h1>
        <span className={connected ? "text-emerald-400 text-sm" : "text-red-400 text-sm"}>
          ● {connected ? "live" : "offline"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className={card}><div className="text-slate-400 text-sm">Total Transactions</div>
          <div className="text-3xl font-bold">{stats?.total_transactions ?? "–"}</div></div>
        <div className={card}><div className="text-slate-400 text-sm">Money Spent</div>
          <div className="text-3xl font-bold text-red-400">{money(stats?.total_money_spent)}</div></div>
        <div className={card}><div className="text-slate-400 text-sm">Money Received</div>
          <div className="text-3xl font-bold text-emerald-400">{money(stats?.total_money_received)}</div></div>
        <div className={card}><div className="text-slate-400 text-sm">Net Profit / Loss</div>
          <div className="text-3xl font-bold">{money(stats?.net)}</div></div>
        <div className={card}><div className="text-slate-400 text-sm">Orders</div>
          <div className="text-3xl font-bold">{stats?.orders ?? "–"}</div></div>
        <div className={card}><div className="text-slate-400 text-sm">Players Observed</div>
          <div className="text-3xl font-bold">{stats?.players_observed ?? "–"}</div></div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Live Feed (WebSocket)</h2>
      <div className="space-y-1 font-mono text-sm">
        {live.length === 0 && <div className="text-slate-500">Waiting for transactions…</div>}
        {live.map((t) => (
          <div key={t.id} className="bg-slate-800/60 rounded px-3 py-1.5">
            {t.minecraft_timestamp ?? t.created_at.slice(11, 19)} · {t.transaction_owner} ·{" "}
            <span className="text-amber-300">{t.transaction_type}</span> ·{" "}
            {t.quantity ?? "?"}x {t.item_name ?? "(unknown)"} ·{" "}
            <span className="text-emerald-300">
              {t.total_price ? `$${Number(t.total_price).toLocaleString()}` : "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
