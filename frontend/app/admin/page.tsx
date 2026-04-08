"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAdminUsage, getAdminRecentLogs, type AdminUsage, type RecentLogs } from "../lib/api";

const ADMIN_KEY = "super-admin-key-change-me";

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLogs | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "developers" | "live">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([
        getAdminUsage(adminKey, days),
        getAdminRecentLogs(adminKey, 100),
      ]);
      setUsage(u);
      setRecentLogs(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [adminKey, days]);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, days, load]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await getAdminUsage(adminKey, 1);
      setAuthenticated(true);
    } catch {
      setError("Invalid admin key.");
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <form onSubmit={handleLogin} className="max-w-sm w-full space-y-4 px-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Admin Dashboard</h2>
              <p className="text-gray-500 text-sm">Enter admin key to access system-wide usage analytics.</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Admin Key</label>
              <input
                required
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="X-Admin-Key"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm bg-red-950/30 rounded px-3 py-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Verifying..." : "Access Dashboard"}
            </button>
            <p className="text-xs text-gray-600 text-center">Demo key: super-admin-key-change-me</p>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs + period selector */}
        <div className="flex items-center justify-between mb-6">
          <nav className="flex gap-1 border-b border-gray-800">
            {[
              { id: "overview" as const, label: "Overview" },
              { id: "developers" as const, label: "Developers" },
              { id: "live" as const, label: "Live Feed" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t.id ? "border-purple-500 text-purple-400" : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {[1, 7, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  days === d ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {d === 1 ? "Today" : `${d}d`}
              </button>
            ))}
            <button onClick={load} className="text-xs text-gray-500 hover:text-gray-300 ml-2">Refresh</button>
          </div>
        </div>

        {loading && <p className="text-gray-500 text-center py-8">Loading...</p>}
        {error && <p className="text-red-400 bg-red-950/30 rounded-lg px-4 py-3 text-sm">{error}</p>}

        {usage && tab === "overview" && <OverviewTab usage={usage} />}
        {usage && tab === "developers" && <DevelopersTab usage={usage} />}
        {recentLogs && tab === "live" && <LiveFeedTab logs={recentLogs} onRefresh={load} />}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-800 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">QuoteOfTheDay</h1>
          <p className="text-gray-500 text-sm">Super Admin Dashboard</p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
          <Link href="/developers" className="text-gray-400 hover:text-white transition-colors">Developer Portal</Link>
          <Link href="/admin" className="text-purple-400 font-medium">Admin</Link>
        </nav>
      </div>
    </header>
  );
}

function OverviewTab({ usage }: { usage: AdminUsage }) {
  const maxDayCount = Math.max(...usage.byDay.map(d => d.count), 1);
  const maxHourCount = Math.max(...usage.todayByHour.map(h => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card label="Total Requests" value={usage.totalRequests} />
        <Card label="Developers" value={usage.totalDevelopers} color="text-blue-400" />
        <Card label="Active Keys" value={usage.totalKeys} color="text-green-400" />
        <Card label="Environments" value={usage.byEnvironment.length} color="text-purple-400" />
      </div>

      {/* By Environment */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gray-400 font-medium">By Environment</p>
        <div className="grid grid-cols-3 gap-4">
          {usage.byEnvironment.map(e => (
            <div key={e.environment} className="bg-gray-800/50 rounded-lg p-3 text-center">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                e.environment === "Dev" ? "bg-yellow-900/50 text-yellow-300" :
                e.environment === "Stage" ? "bg-blue-900/50 text-blue-300" :
                "bg-green-900/50 text-green-300"
              }`}>{e.environment}</span>
              <p className="text-xl font-bold mt-2">{e.totalRequests}</p>
              <p className="text-xs text-gray-500">{e.uniqueClients} clients | avg {e.avgResponseMs}ms</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily chart */}
      {usage.byDay.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-400 font-medium">Requests by Day</p>
          <div className="space-y-1">
            {usage.byDay.map(d => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-20 text-right font-mono">{d.date.slice(5)}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${(d.count / maxDayCount) * 100}%` }}
                  />
                </div>
                <span className="text-gray-400 w-12 text-right">{d.count} req</span>
                <span className="text-gray-600 w-16 text-right">{d.uniqueClients} clients</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's hourly */}
      {usage.todayByHour.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-400 font-medium">Today by Hour (UTC)</p>
          <div className="flex items-end gap-1 h-24">
            {Array.from({ length: 24 }, (_, h) => {
              const data = usage.todayByHour.find(x => x.hour === h);
              const count = data?.count ?? 0;
              const height = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-800 rounded-t relative" style={{ height: "80px" }}>
                    <div
                      className="absolute bottom-0 w-full bg-purple-500/70 rounded-t transition-all"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-600">{h}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Endpoints */}
      {usage.byEndpoint.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-400 font-medium">Top Endpoints</p>
          {usage.byEndpoint.map(e => (
            <div key={`${e.method}-${e.endpoint}`} className="flex items-center justify-between text-xs py-1">
              <span className="font-mono text-gray-300">
                <span className="text-green-400">{e.method}</span> {e.endpoint}
              </span>
              <span className="text-gray-400">{e.count} req | avg {e.avgResponseMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DevelopersTab({ usage }: { usage: AdminUsage }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs">
              <th className="px-4 py-3">Developer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3 text-right">Keys</th>
              <th className="px-4 py-3 text-right">Requests</th>
              <th className="px-4 py-3 text-right">Success</th>
              <th className="px-4 py-3 text-right">Errors</th>
              <th className="px-4 py-3 text-right">Avg ms</th>
            </tr>
          </thead>
          <tbody>
            {usage.byDeveloper.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">No developer activity in this period.</td></tr>
            ) : (
              usage.byDeveloper.map(d => (
                <tr key={d.developerId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{d.developerName}</td>
                  <td className="px-4 py-3 text-gray-400">{d.developerEmail}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{d.keyCount}</td>
                  <td className="px-4 py-3 text-right text-white font-medium">{d.totalRequests}</td>
                  <td className="px-4 py-3 text-right text-green-400">{d.successCount}</td>
                  <td className="px-4 py-3 text-right text-red-400">{d.errorCount}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{d.avgResponseMs}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LiveFeedTab({ logs, onRefresh }: { logs: RecentLogs; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Last {logs.count} API calls</p>
        <button onClick={onRefresh} className="text-xs text-purple-400 hover:text-purple-300">Refresh</button>
      </div>
      <div className="bg-gray-900 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Env</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Endpoint</th>
              <th className="px-3 py-2 text-right">Status</th>
              <th className="px-3 py-2 text-right">Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {logs.logs.map((l, i) => (
              <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="px-3 py-1.5 text-gray-500 font-mono">
                  {new Date(l.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-3 py-1.5 text-gray-300 font-mono truncate max-w-[140px]">{l.clientId}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    l.environment === "Dev" ? "bg-yellow-900/50 text-yellow-300" :
                    l.environment === "Stage" ? "bg-blue-900/50 text-blue-300" :
                    "bg-green-900/50 text-green-300"
                  }`}>{l.environment}</span>
                </td>
                <td className="px-3 py-1.5 text-green-400 font-mono">{l.method}</td>
                <td className="px-3 py-1.5 text-gray-300 font-mono">{l.endpoint}</td>
                <td className={`px-3 py-1.5 text-right font-mono ${
                  l.statusCode < 300 ? "text-green-400" : l.statusCode < 400 ? "text-yellow-400" : "text-red-400"
                }`}>{l.statusCode}</td>
                <td className="px-3 py-1.5 text-right text-gray-400">{l.responseTimeMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
