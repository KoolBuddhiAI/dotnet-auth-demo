import Link from "next/link";

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">QuoteOfTheDay</h1>
            <p className="text-gray-500 text-sm">API Documentation</p>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link href="/developers" className="text-gray-400 hover:text-white transition-colors">Developer Portal</Link>
            <Link href="/docs" className="text-blue-400 font-medium">API Docs</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {/* Overview */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Getting Started</h2>
          <p className="text-gray-400 leading-relaxed">
            The QuoteOfTheDay API provides access to a curated collection of inspirational quotes.
            Register for free, create API keys for your environments, and start fetching quotes.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-gray-300"><strong>1.</strong> Register at the <Link href="/developers" className="text-blue-400 hover:underline">Developer Portal</Link></p>
            <p className="text-gray-300"><strong>2.</strong> Create an API key for your environment (Dev, Stage, or Prod)</p>
            <p className="text-gray-300"><strong>3.</strong> Exchange your client credentials for an access token</p>
            <p className="text-gray-300"><strong>4.</strong> Use the token to call the Quotes API</p>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Rate Limits by Environment</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="pb-2 pr-4">Environment</th>
                  <th className="pb-2 pr-4">Rate Limit</th>
                  <th className="pb-2 pr-4">Key Expiry</th>
                  <th className="pb-2 pr-4">Max Keys</th>
                  <th className="pb-2">Use Case</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800/50">
                  <td className="py-2 pr-4"><span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded-full">Dev</span></td>
                  <td className="py-2 pr-4">10 req/min</td>
                  <td className="py-2 pr-4">30 days</td>
                  <td className="py-2 pr-4">5</td>
                  <td className="py-2 text-gray-500">Local development, testing</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="py-2 pr-4"><span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">Stage</span></td>
                  <td className="py-2 pr-4">30 req/min</td>
                  <td className="py-2 pr-4">90 days</td>
                  <td className="py-2 pr-4">3</td>
                  <td className="py-2 text-gray-500">Staging, QA, pre-production</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">Prod</span></td>
                  <td className="py-2 pr-4">100 req/min</td>
                  <td className="py-2 pr-4">Never</td>
                  <td className="py-2 pr-4">2</td>
                  <td className="py-2 text-gray-500">Production applications</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Authentication */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Authentication</h2>
          <p className="text-gray-400 text-sm">
            Use OAuth2 Client Credentials flow to get an access token.
          </p>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400">POST /connect/token</div>
            <pre className="px-4 py-3 text-sm text-gray-300 font-mono overflow-x-auto">{`curl -X POST http://localhost:5090/connect/token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}</pre>
          </div>
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400">Response</div>
            <pre className="px-4 py-3 text-sm text-green-300 font-mono overflow-x-auto">{`{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 3600
}`}</pre>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">API Endpoints</h2>
          <p className="text-gray-500 text-sm">All endpoints require a valid Bearer token in the Authorization header.</p>

          <Endpoint
            method="GET"
            path="/api/v1/quotes/today"
            description="Get today's quote. Changes daily."
            example={`{
  "text": "The only way to do great work is to love what you do.",
  "author": "Steve Jobs",
  "category": "Motivation",
  "date": "2026-04-08",
  "_meta": { "environment": "dev", "source": "QuoteOfTheDay API v1" }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/quotes/random"
            description="Get a random quote."
            example={`{
  "text": "Stay hungry, stay foolish.",
  "author": "Steve Jobs",
  "category": "Motivation",
  "_meta": { "environment": "dev", "source": "QuoteOfTheDay API v1" }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/v1/quotes?category=Life&page=1&pageSize=10"
            description="List quotes with optional filtering and pagination."
            example={`{
  "total": 7,
  "page": 1,
  "pageSize": 10,
  "quotes": [ ... ],
  "_meta": { "environment": "dev", "source": "QuoteOfTheDay API v1" }
}`}
          />
        </section>

        {/* Key Management */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Key Management</h2>
          <p className="text-gray-400 text-sm">
            Manage your keys through the Developer Portal or programmatically via the API:
          </p>
          <div className="space-y-1.5 text-sm text-gray-300 font-mono bg-gray-900 rounded-lg p-4">
            <p><span className="text-green-400">POST</span> /api/developers/register — Register</p>
            <p><span className="text-blue-400">GET</span>&nbsp; /api/developers/lookup?email=... — Find account</p>
            <p><span className="text-green-400">POST</span> /api/developers/:id/keys — Create key</p>
            <p><span className="text-blue-400">GET</span>&nbsp; /api/developers/:id/keys/:keyId — View key + secret</p>
            <p><span className="text-amber-400">POST</span> /api/developers/:id/keys/:keyId/rotate — Rotate secret</p>
            <p><span className="text-red-400">DEL</span>&nbsp; /api/developers/:id/keys/:keyId — Delete key</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Endpoint({ method, path, description, example }: {
  method: string;
  path: string;
  description: string;
  example: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-800 flex items-center gap-3">
        <span className="text-xs font-mono font-bold text-green-400">{method}</span>
        <span className="text-sm font-mono text-gray-300">{path}</span>
      </div>
      <div className="px-4 py-2 text-sm text-gray-400 border-b border-gray-800">{description}</div>
      <pre className="px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">{example}</pre>
    </div>
  );
}
