"use client";

import { useEffect, useState } from "react";
import { getDeveloperUsage, type UsageSummary } from "../lib/api";

interface Props {
  developerId: string;
}

export default function UsageStats({ developerId }: Props) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setUsage(await getDeveloperUsage(developerId, days));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [developerId, days]);

  if (loading) return <div className="text-gray-500 py-6 text-center text-sm">Loading usage data...</div>;
  if (!usage) return <div className="text-gray-600 py-6 text-center text-sm">No usage data available.</div>;

  const maxDayCount = Math.max(...usage.byDay.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">API Usage</h3>
        <div className="flex gap-2">
          {[1, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                days === d ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {d === 1 ? "Today" : `${d}d`}
            </button>
          ))}
          <button onClick={load} className="text-xs text-gray-500 hover:text-gray-300 ml-2">Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{usage.totalRequests}</p>
          <p className="text-xs text-gray-500">Total Requests</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{usage.byKey.reduce((s, k) => s + k.successCount, 0)}</p>
          <p className="text-xs text-gray-500">Successful</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{usage.byKey.reduce((s, k) => s + k.errorCount, 0)}</p>
          <p className="text-xs text-gray-500">Errors</p>
        </div>
      </div>

      {/* Daily chart (simple bar) */}
      {usage.byDay.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-400">Requests by Day</p>
          <div className="space-y-1">
            {usage.byDay.map(d => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-20 text-right font-mono">{d.date.slice(5)}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${(d.count / maxDayCount) * 100}%` }}
                  />
                </div>
                <span className="text-gray-400 w-8 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Key */}
      {usage.byKey.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-400">Usage by Key</p>
          {usage.byKey.map(k => (
            <div key={k.keyId} className="flex items-center justify-between text-sm border-b border-gray-800 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="font-mono text-xs text-gray-300">{k.clientId}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  k.environment === "Dev" ? "bg-yellow-900/50 text-yellow-300" :
                  k.environment === "Stage" ? "bg-blue-900/50 text-blue-300" :
                  "bg-green-900/50 text-green-300"
                }`}>{k.environment}</span>
              </div>
              <div className="text-right">
                <p className="text-white">{k.totalRequests} requests</p>
                <p className="text-xs text-gray-500">avg {k.avgResponseMs}ms</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By Endpoint */}
      {usage.byEndpoint.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-400">Top Endpoints</p>
          {usage.byEndpoint.map(e => (
            <div key={`${e.method}-${e.endpoint}`} className="flex items-center justify-between text-xs">
              <span className="font-mono text-gray-300">
                <span className="text-green-400">{e.method}</span> {e.endpoint}
              </span>
              <span className="text-gray-400">{e.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
