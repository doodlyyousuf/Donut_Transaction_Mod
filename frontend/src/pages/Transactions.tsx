import { useEffect, useState } from "react";
import { api, Tx } from "../api";

const TYPES = ["", "BUY", "SELL", "LIST", "ORDER_DELIVERY", "PAYMENT_SENT", "PAYMENT_RECEIVED"];

export default function Transactions() {
  const [data, setData] = useState<{ total: number; items: Tx[] }>({ total: 0, items: [] });
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [player, setPlayer] = useState("");
  const [item, setItem] = useState("");
  const limit = 50;

  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (type) p.set("type", type);
    if (player) p.set("player", player);
    if (item) p.set("item", item);
    api.transactions(p).then(setData).catch(() => {});
  }, [page, type, player, item]);

  const pages = Math.max(1, Math.ceil(data.total / limit));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Transactions</h1>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input placeholder="Player" value={player}
               onChange={(e) => { setPlayer(e.target.value); setPage(1); }}
               className="bg-slate-800 rounded px-3 py-2 border border-slate-700" />
        <input placeholder="Item" value={item}
               onChange={(e) => { setItem(e.target.value); setPage(1); }}
               className="bg-slate-800 rounded px-3 py-2 border border-slate-700" />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="bg-slate-800 rounded px-3 py-2 border border-slate-700">
          {TYPES.map((t) => <option key={t} value={t}>{t || "All types"}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left border-b border-slate-700">
            <tr><th className="p-2">Time</th><th>Player</th><th>Action</th>
                <th>Item</th><th>Qty</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-2 font-mono">{t.minecraft_timestamp ?? t.created_at.slice(11, 19)}</td>
                <td>{t.transaction_owner}</td>
                <td className="text-amber-300">{t.transaction_type}</td>
                <td>{t.item_name ?? <span className="text-slate-500">(unknown)</span>}</td>
                <td>{t.quantity ?? "–"}</td>
                <td className="text-right font-mono">
                  {t.total_price ? `$${Number(t.total_price).toLocaleString()}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40">← Prev</button>
        <span>Page {page} / {pages} · {data.total} records</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
