"use client";

import { useState } from "react";
import {
  createApiKey,
  rotateApiKey,
  deleteApiKey,
  getToken,
  callProtectedQuotes,
  type Developer,
  type ApiKeyInfo,
} from "../lib/api";

interface Props {
  developer: Developer;
  onRefresh: () => void;
}

const ENV_CONFIG = {
  Dev: { color: "bg-yellow-900/50 text-yellow-300", limit: "10 req/min", expiry: "30 days", max: 5 },
  Stage: { color: "bg-blue-900/50 text-blue-300", limit: "30 req/min", expiry: "90 days", max: 3 },
  Prod: { color: "bg-green-900/50 text-green-300", limit: "100 req/min", expiry: "Never", max: 2 },
};

export default function KeyManager({ developer, onRefresh }: Props) {
  const [creating, setCreating] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [testResult, setTestResult] = useState<{ keyId: string; data: unknown } | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);

  const clearMessages = () => { setError(null); setSuccess(null); };

  const handleCreate = async (env: string) => {
    clearMessages();
    try {
      const result = await createApiKey(developer.id, env, label || `${env} Key`);
      setSuccess(`Key created! Client ID: ${result.clientId}`);
      setCreating(null);
      setLabel("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    }
  };

  const handleRotate = async (key: ApiKeyInfo) => {
    clearMessages();
    if (!confirm(`Rotate secret for "${key.label}"? The old secret will stop working for new token requests.`)) return;
    try {
      const result = await rotateApiKey(developer.id, key.id);
      setSuccess(`Secret rotated. New secret: ${result.clientSecret}`);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rotation failed");
    }
  };

  const handleDelete = async (key: ApiKeyInfo) => {
    clearMessages();
    if (!confirm(`Delete "${key.label}"? This will immediately revoke all tokens.`)) return;
    try {
      await deleteApiKey(developer.id, key.id);
      setSuccess(`Key "${key.label}" deleted.`);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleTest = async (key: ApiKeyInfo) => {
    clearMessages();
    setTestResult(null);
    setTestLoading(key.id);
    try {
      const tokenRes = await getToken(key.clientId, key.clientSecret);
      const data = await callProtectedQuotes(tokenRes.access_token);
      setTestResult({ keyId: key.id, data });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestLoading(null);
    }
  };

  const toggleSecret = (keyId: string) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const groupedKeys: Record<string, ApiKeyInfo[]> = { Dev: [], Stage: [], Prod: [] };
  (developer.keys ?? []).forEach((k) => {
    if (groupedKeys[k.environment]) groupedKeys[k.environment].push(k);
  });

  return (
    <div className="space-y-6">
      {/* Developer info */}
      <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{developer.name}</p>
          <p className="text-sm text-gray-400">{developer.email}</p>
        </div>
        <p className="text-xs text-gray-600">ID: {developer.id.slice(0, 8)}...</p>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-3">{error}</p>}
      {success && <p className="text-green-400 text-sm bg-green-950/30 rounded-lg px-4 py-3">{success}</p>}

      {/* Environment sections */}
      {(["Dev", "Stage", "Prod"] as const).map((env) => {
        const config = ENV_CONFIG[env];
        const keys = groupedKeys[env];

        return (
          <div key={env} className="border border-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-900/50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.color}`}>{env}</span>
                <span className="text-xs text-gray-500">{config.limit} | Expires: {config.expiry} | Max {config.max} keys</span>
              </div>
              <button
                onClick={() => setCreating(creating === env ? null : env)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + New Key
              </button>
            </div>

            {creating === env && (
              <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-800 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Label</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={`e.g. ${env} - My App`}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => handleCreate(env)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-1.5 rounded transition-colors whitespace-nowrap"
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreating(null); setLabel(""); }}
                  className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            )}

            {keys.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-600 text-sm">
                No {env.toLowerCase()} keys yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {keys.map((key) => (
                  <div key={key.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{key.label}</p>
                        <p className="text-xs text-gray-500 font-mono">{key.clientId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {key.isExpired && (
                          <span className="text-xs text-red-400 bg-red-950/50 px-2 py-0.5 rounded">Expired</span>
                        )}
                        <button
                          onClick={() => handleTest(key)}
                          disabled={testLoading === key.id}
                          className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-purple-950/30 transition-colors"
                        >
                          {testLoading === key.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => handleRotate(key)}
                          className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-950/30 transition-colors"
                        >
                          Rotate
                        </button>
                        <button
                          onClick={() => handleDelete(key)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-950/30 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Secret:</span>
                      <code className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded flex-1 truncate">
                        {revealedSecrets.has(key.id) ? key.clientSecret : "••••••••••••••••••••••••"}
                      </code>
                      <button
                        onClick={() => toggleSecret(key.id)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {revealedSecrets.has(key.id) ? "Hide" : "Show"}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(key.clientSecret)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="text-xs text-gray-600">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                      {key.expiresAt && <> | Expires: {new Date(key.expiresAt).toLocaleDateString()}</>}
                    </div>

                    {testResult?.keyId === key.id && (
                      <div className="bg-gray-800 rounded p-3 mt-2">
                        <p className="text-xs text-green-400 mb-1">API Response (GET /api/v1/quotes/today):</p>
                        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
