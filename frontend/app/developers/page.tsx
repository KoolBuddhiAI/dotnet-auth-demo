"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { getDeveloper, type Developer } from "../lib/api";
import DevRegistration from "../components/DevRegistration";
import KeyManager from "../components/KeyManager";

export default function DeveloperPortal() {
  const [developer, setDeveloper] = useState<Developer | null>(null);

  const refresh = useCallback(async () => {
    if (!developer) return;
    const updated = await getDeveloper(developer.id);
    setDeveloper(updated);
  }, [developer]);

  const handleSignOut = () => setDeveloper(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">QuoteOfTheDay</h1>
            <p className="text-gray-500 text-sm">Developer Portal</p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link href="/developers" className="text-blue-400 font-medium">Developer Portal</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">API Docs</Link>
            {developer && (
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-300 text-sm ml-2"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!developer ? (
          <DevRegistration onAuthenticated={setDeveloper} />
        ) : (
          <KeyManager developer={developer} onRefresh={refresh} />
        )}
      </main>
    </div>
  );
}
