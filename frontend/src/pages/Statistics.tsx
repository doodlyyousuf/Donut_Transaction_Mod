import { useEffect, useState } from "react";
import { api } from "../api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Statistics() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-400">Loading statistics…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Statistics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">Transaction Volume Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Line type="monotone" dataKey="transactions" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-slate-500 text-sm mt-4">Time series data requires backend endpoint extension</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold mb-4">Money Flow Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Line type="monotone" dataKey="spent" stroke="#ef4444" strokeWidth={2} name="Spent" />
              <Line type="monotone" dataKey="received" stroke="#10b981" strokeWidth={2} name="Received" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-slate-500 text-sm mt-4">Time series data requires backend endpoint extension</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4">Overall Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-slate-400 text-sm">Total Transactions</div>
            <div className="text-2xl font-bold">{stats.total_transactions}</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Net Position</div>
            <div className="text-2xl font-bold">${Number(stats.net).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Active Orders</div>
            <div className="text-2xl font-bold">{stats.orders}</div>
          </div>
          <div>
            <div className="text-slate-400 text-sm">Unique Players</div>
            <div className="text-2xl font-bold">{stats.players_observed}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
