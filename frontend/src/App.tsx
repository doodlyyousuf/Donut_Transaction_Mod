import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Orders from "./pages/Orders";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";

const link = "px-3 py-2 rounded hover:bg-slate-800 text-slate-300";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <nav className="flex gap-1 p-4 border-b border-slate-800">
          <NavLink className={link} to="/">Dashboard</NavLink>
          <NavLink className={link} to="/transactions">Transactions</NavLink>
          <NavLink className={link} to="/orders">Orders</NavLink>
          <NavLink className={link} to="/players">Players</NavLink>
          <NavLink className={link} to="/statistics">Statistics</NavLink>
          <NavLink className={link} to="/settings">Settings</NavLink>
        </nav>
        <main className="p-6 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/:username" element={<PlayerDetail />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
