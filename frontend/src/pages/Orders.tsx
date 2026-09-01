import { useEffect, useState } from "react";
import { api } from "../api";

export default function Orders() {
  const [data, setData] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    api.orders().then(setData).catch(() => {});
  }, [page]);

  const pages = Math.max(1, Math.ceil(data.total / limit));

  const statusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "text-emerald-400";
      case "PENDING": return "text-amber-400";
      case "PARTIALLY_FILLED": return "text-blue-400";
      case "CANCELLED": return "text-red-400";
      default: return "text-slate-400";
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left border-b border-slate-700">
            <tr><th className="p-2">ID</th><th>Owner</th><th>Item</th><th>Qty</th>
                <th>Fulfilled</th><th>Remaining</th><th>Status</th><th>Created</th></tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-2 font-mono">#{o.id}</td>
                <td>{o.owner_username}</td>
                <td>{o.item_name ?? <span className="text-slate-500">(unknown)</span>}</td>
                <td>{o.quantity ?? "–"}</td>
                <td>{o.fulfilled_quantity ?? 0}</td>
                <td>{o.remaining_quantity ?? "–"}</td>
                <td className={statusColor(o.status)}>{o.status}</td>
                <td className="text-slate-400">{new Date(o.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40">← Prev</button>
        <span>Page {page} / {pages} · {data.total} orders</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                className="px-3 py-1 bg-slate-800 rounded disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
