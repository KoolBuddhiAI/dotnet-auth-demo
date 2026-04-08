"use client";

import { useState, type FormEvent } from "react";
import { registerDeveloper, lookupDeveloper, type Developer } from "../lib/api";

interface Props {
  onAuthenticated: (dev: Developer) => void;
}

export default function DevRegistration({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"register" | "lookup">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await registerDeveloper(name, email);
      onAuthenticated(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      if (msg.includes("already exists")) {
        setError("This email is already registered. Try looking up your account instead.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const dev = await lookupDeveloper(email);
      onAuthenticated(dev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Developer Portal</h2>
        <p className="text-gray-400">Register or sign in to manage your API keys</p>
      </div>

      <div className="flex bg-gray-900 rounded-lg p-1">
        <button
          onClick={() => setMode("register")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "register" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Register
        </button>
        <button
          onClick={() => setMode("lookup")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "lookup" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          I have an account
        </button>
      </div>

      {mode === "register" ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Registering..." : "Create Account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Looking up..." : "Find My Account"}
          </button>
        </form>
      )}

      {error && <p className="text-red-400 text-sm bg-red-950/30 rounded-lg px-4 py-3">{error}</p>}
    </div>
  );
}
