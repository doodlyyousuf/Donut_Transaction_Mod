export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">Backend Configuration</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">API Base URL</span>
            <span className="font-mono">{import.meta.env.VITE_API_BASE || "http://localhost:8000"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Dashboard Port</span>
            <span className="font-mono">8765</span>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-4">
          These settings are configured via environment variables. See your backend .env file.
        </p>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">API Key</h2>
        <p className="text-slate-400 text-sm mb-3">
          The API key is stored only in the Minecraft mod's local configuration file and is never exposed to the browser.
        </p>
        <div className="bg-slate-900 rounded px-3 py-2 font-mono text-xs text-slate-500">
          Location: .minecraft/config/donutsmp-transaction-tracker/donutsmp-transaction-tracker.json
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4">About</h2>
        <div className="text-sm text-slate-400 space-y-2">
          <p><strong>DonutSMP Transaction Tracker</strong></p>
          <p>Version 1.0.0</p>
          <p>Observation-based transaction tracking for *.donutsmp.net servers.</p>
          <p className="text-xs mt-4">
            This dashboard connects to the FastAPI backend to display real-time transaction data.
            Data is collected by the Fabric mod through passive chat observation.
          </p>
        </div>
      </div>
    </div>
  );
}
