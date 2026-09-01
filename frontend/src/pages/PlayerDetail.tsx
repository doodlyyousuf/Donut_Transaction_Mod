import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function PlayerDetail() {
  const { username = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.player(username).then(setData).catch((e) =>
      setError("No observed transactions for this player yet."));
  }, [username]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!data) return <div className="text-slate-400">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{data.username}</h1>
      <p className="text-slate-500 text-sm mb-6">{data.note}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-4"><div className="text-slate-400 text-xs">Observed Transactions</div>
          <div className="text-2xl font-bold">{data.observed_transactions}</div></div>
        <div className="bg-slate-800 rounded-xl p-4"><div className="text-slate-400 text-xs">Money Spent</div>
          <div className="text-2xl font-bold text-red-400">${Number(data.money_spent).toLocaleString()}</div></div>
        <div className="bg-slate-800 rounded-xl p-4"><div className="text-slate-400 text-xs">Money Received</div>
          <div className="text-2xl font-bold text-emerald-400">${Number(data.money_received).toLocaleString()}</div></div>
        <div className="bg-slate-800 rounded-xl p-4"><div className="text-slate-400 text-xs">Total Volume</div>
          <div className="text-2xl font-bold">${Number(data.total_volume).toLocaleString()}</div></div>
      </div>

      <h2 className="text-lg font-semibold mb-2">Frequently Traded Items</h2>
      <ul className="mb-8 text-sm space-y-1">
        {data.frequently_traded_items.map((it: any) => (
          <li key={it.item} className="bg-slate-800/60 rounded px-3 py-1.5 flex justify-between">
            <span>{it.item}</span><span className="text-slate-400">{it.count}×</span>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold mb-2">Recent Transactions</h2>
      <div className="font-mono text-sm space-y-1">
        {data.recent.map((t: any) => (
          <div key={t.id} className="bg-slate-800/60 rounded px-3 py-1.5">
            {t.created_at.slice(0, 19).replace("T", " ")} · {t.transaction_type} ·{" "}
            {t.quantity ?? "?"}x {t.item_name ?? "(unknown)"} ·{" "}
            {t.total_price ? `$${Number(t.total_price).toLocaleString()}` : "–"}
          </div>
        ))}
      </div>
    </div>
  );
}
