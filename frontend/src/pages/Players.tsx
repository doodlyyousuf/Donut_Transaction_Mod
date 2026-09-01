import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Players() {
  const [players, setPlayers] = useState<{ username: string; observed_transactions: number }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.players().then(setPlayers).catch(() => {});
  }, []);

  const filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Players</h1>
      <input
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-slate-800 rounded px-3 py-2 border border-slate-700 mb-4 w-full max-w-md"
      />
      <div className="space-y-2">
        {filtered.map((p) => (
          <Link
            key={p.username}
            to={`/players/${p.username}`}
            className="block bg-slate-800 rounded px-4 py-3 hover:bg-slate-700 border border-slate-700"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold">{p.username}</span>
              <span className="text-slate-400 text-sm">{p.observed_transactions} transactions</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
