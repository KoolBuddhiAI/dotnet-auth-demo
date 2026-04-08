"use client";

import { useEffect, useState } from "react";
import { getQuoteOfTheDay, getRandomQuote, type Quote } from "./lib/api";
import Link from "next/link";

export default function Home() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuoteOfTheDay()
      .then(setQuote)
      .finally(() => setLoading(false));
  }, []);

  const handleRandom = async () => {
    setLoading(true);
    try {
      setQuote(await getRandomQuote());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">QuoteOfTheDay</h1>
            <p className="text-gray-500 text-sm">Daily inspiration, powered by API</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-blue-400 font-medium">Home</Link>
            <Link href="/developers" className="text-gray-400 hover:text-white transition-colors">Developer Portal</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition-colors">API Docs</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          {loading ? (
            <p className="text-gray-500 text-lg">Loading...</p>
          ) : quote ? (
            <>
              <blockquote className="text-3xl md:text-4xl font-light leading-relaxed text-gray-100">
                &ldquo;{quote.text}&rdquo;
              </blockquote>
              <div className="space-y-2">
                <p className="text-lg text-gray-400">&mdash; {quote.author}</p>
                <span className="inline-block text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
                  {quote.category}
                </span>
                {quote.date && (
                  <p className="text-xs text-gray-600 mt-2">{quote.date}</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500">No quote available.</p>
          )}

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={handleRandom}
              disabled={loading}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Another Quote
            </button>
            <Link
              href="/developers"
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Get API Access
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between text-xs text-gray-600">
          <span>Main app — unrestricted API access (no auth needed)</span>
          <span>3rd-party access available via Developer Portal</span>
        </div>
      </footer>
    </div>
  );
}
