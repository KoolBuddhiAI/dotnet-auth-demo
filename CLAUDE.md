# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Backend (.NET 8 API)
```bash
dotnet build src/AuthDemo.Api              # Build
dotnet run --project src/AuthDemo.Api      # Run (https://localhost:7090, http://localhost:5090)
dotnet test tests/AuthDemo.Api.Tests       # Run tests (xunit)
dotnet test --filter "FullyQualifiedName~TestName"  # Single test
```

### Frontend (Next.js 16)
```bash
cd frontend && npm install                 # Install dependencies
cd frontend && npm run dev                 # Dev server (http://localhost:3000)
cd frontend && npm run build               # Production build
```

Both must run simultaneously. The frontend proxies `/api/*` and `/connect/*` to the backend via `next.config.ts` rewrites (targets `http://localhost:5090`).

## Architecture

This is a **QuoteOfTheDay** app demonstrating OAuth2 M2M auth with a developer self-service portal.

### Two-tier access model
- **Main app** (homepage) calls `/api/quotes/*` directly — no auth, no rate limits
- **3rd-party developers** register, get API keys per environment (Dev/Stage/Prod), exchange credentials for tokens via `/connect/token`, then call `/api/v1/quotes/*` — authenticated and rate-limited

### Backend structure
- **OpenIddict 5.8** handles OAuth2 client credentials flow. Each API key = one OpenIddict application. Token endpoint uses passthrough mode with a custom `ConnectController`.
- **EF Core InMemory** — all data (quotes, developers, keys, usage logs, OpenIddict entities) in a single `ApplicationDbContext`. 30 quotes seeded on startup.
- **Rate limiting** — ASP.NET Core sliding window: Dev 10/min, Stage 30/min, Prod 100/min. Partitioned by `client_id` claim.
- **Usage logging** — `ApiUsageLoggingMiddleware` logs all `/api/v1/*` requests to `ApiUsageLog` table after response.
- **Admin** — `/api/admin/usage` endpoints protected by `X-Admin-Key: super-admin-key-change-me` header.

### Key controller mapping
| Controller | Route | Auth |
|---|---|---|
| `QuotesController` | `/api/quotes/*` | None (main app) |
| `ApiQuotesController` | `/api/v1/quotes/*` | Bearer token + rate limit |
| `DevelopersController` | `/api/developers/*` | None (self-service) |
| `ConnectController` | `/connect/token` | Client credentials |
| `UsageController` | `/api/developers/{id}/usage` | None |
| `AdminUsageController` | `/api/admin/usage` | X-Admin-Key header |

### Middleware pipeline order
Routing -> CORS -> Authentication -> Authorization -> Rate Limiter -> Usage Logger -> Controllers

### Frontend pages
- `/` — Quote of the Day (calls public API)
- `/developers` — Register/lookup, manage keys (Dev/Stage/Prod), view usage stats
- `/admin` — System-wide usage dashboard (requires admin key)
- `/docs` — API documentation

### Data relationships
`Developer` 1:N `ApiKey` (each key has environment + maps to an OpenIddict application) -> `ApiKey` 1:N `ApiUsageLog`

## Git Push

Remote uses SSH with a specific key:
```bash
git push origin master                     # Works if ~/.ssh/config has github.com entry
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_koolbuddhiai -o IdentitiesOnly=yes" git push origin master  # Explicit key
```
