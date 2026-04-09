# QuoteOfTheDay - Architecture Document

## Overview

QuoteOfTheDay is a full-stack application demonstrating OAuth2 machine-to-machine (M2M) authentication with self-service API key management. The main app serves quotes publicly, while third-party developers register for controlled API access with environment-based rate limiting and usage analytics.

## System Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js - localhost:3000)"]
        Home["/ Home<br/>Quote of the Day"]
        DevPortal["/developers<br/>Developer Portal"]
        Docs["/docs<br/>API Documentation"]
        Admin["/admin<br/>Super Admin Dashboard"]
    end

    subgraph Proxy["Next.js Rewrites (Proxy)"]
        R1["/api/* -> localhost:5090/api/*"]
        R2["/connect/* -> localhost:5090/connect/*"]
    end

    subgraph Backend["Backend (.NET 8 - localhost:5090 / 7090)"]
        subgraph Public["Public Endpoints (No Auth)"]
            QC["QuotesController<br/>/api/quotes/*"]
            DC["DevelopersController<br/>/api/developers/*"]
        end

        subgraph Protected["Protected Endpoints (Bearer Token)"]
            AQC["ApiQuotesController<br/>/api/v1/quotes/*"]
        end

        subgraph AdminAPI["Admin Endpoints (X-Admin-Key)"]
            AUC["AdminUsageController<br/>/api/admin/usage/*"]
        end

        subgraph OAuth["OAuth2 Server (OpenIddict)"]
            CC["ConnectController<br/>POST /connect/token"]
        end

        subgraph Middleware["Middleware Pipeline"]
            CORS["CORS"]
            Auth["Authentication"]
            Authz["Authorization"]
            RL["Rate Limiter"]
            UL["Usage Logger"]
        end

        subgraph Data["Data Layer"]
            DB["EF Core InMemory DB"]
        end
    end

    Home --> R1
    DevPortal --> R1
    DevPortal --> R2
    Admin --> R1

    R1 --> QC
    R1 --> DC
    R1 --> AQC
    R1 --> AUC
    R2 --> CC

    AQC --> Middleware
    Middleware --> DB
    QC --> DB
    DC --> DB
    CC --> DB
    AUC --> DB
```

## Data Model

```mermaid
erDiagram
    Developer ||--o{ ApiKey : "has many"
    ApiKey ||--o{ ApiUsageLog : "generates"
    Developer ||--o{ ApiUsageLog : "owns"

    Developer {
        Guid Id PK
        string Name
        string Email UK
        DateTime RegisteredAt
    }

    ApiKey {
        Guid Id PK
        string Label
        KeyEnvironment Environment "Dev | Stage | Prod"
        string ClientId UK
        string ClientSecret
        DateTime CreatedAt
        DateTime ExpiresAt "null for Prod"
        bool IsActive
        Guid DeveloperId FK
    }

    ApiUsageLog {
        long Id PK
        string ClientId IX
        string Endpoint
        string Method
        int StatusCode
        string Environment
        long ResponseTimeMs
        DateTime Timestamp IX
        Guid ApiKeyId FK
        Guid DeveloperId IX
    }

    Quote {
        int Id PK
        string Text
        string Author
        string Category
    }

    OpenIddictApplication {
        string Id PK
        string ClientId
        string ClientSecret "hashed"
        string DisplayName
        string Permissions "JSON"
    }
```

## OAuth2 Client Credentials Flow

```mermaid
sequenceDiagram
    participant Dev as 3rd-Party App
    participant Portal as Developer Portal
    participant API as .NET API
    participant OIDC as OpenIddict Server
    participant DB as Database

    Note over Dev, DB: Phase 1 - Registration & Key Setup
    Dev->>Portal: Register (name, email)
    Portal->>API: POST /api/developers/register
    API->>DB: Create Developer record
    API-->>Portal: Developer { id, email }

    Dev->>Portal: Create API Key (environment: Dev)
    Portal->>API: POST /api/developers/{id}/keys
    API->>OIDC: Create OpenIddict Application
    API->>DB: Create ApiKey record
    API-->>Portal: { clientId, clientSecret, rateLimits }

    Note over Dev, DB: Phase 2 - Token Exchange
    Dev->>API: POST /connect/token<br/>grant_type=client_credentials<br/>client_id=...&client_secret=...
    API->>OIDC: Validate client credentials
    OIDC->>DB: Lookup OpenIddict Application
    API->>DB: Check ApiKey (active? expired?)
    API->>OIDC: Create ClaimsIdentity (sub, name, env)
    OIDC-->>Dev: { access_token, token_type, expires_in }

    Note over Dev, DB: Phase 3 - API Access
    Dev->>API: GET /api/v1/quotes/today<br/>Authorization: Bearer {token}
    API->>API: OpenIddict Validation (verify JWT)
    API->>API: Rate Limiter (check env policy)
    API->>DB: Fetch quote
    API->>DB: Log usage (ApiUsageLog)
    API-->>Dev: { text, author, category, _meta }
```

## Request Pipeline

```mermaid
flowchart LR
    Request([Incoming Request])
    Routing[Routing]
    CORS[CORS]
    AuthN["Authentication<br/>(OpenIddict Validation)"]
    AuthZ[Authorization]
    RateLimit["Rate Limiter<br/>(Sliding Window)"]
    UsageLog["Usage Logger<br/>(/api/v1/* only)"]
    Controller([Controller Action])

    Request --> Routing --> CORS --> AuthN --> AuthZ --> RateLimit --> UsageLog --> Controller

    style Request fill:#374151,stroke:#6B7280,color:#fff
    style Controller fill:#374151,stroke:#6B7280,color:#fff
```

### Middleware Behavior

| Middleware | Scope | Purpose |
|---|---|---|
| **Routing** | All requests | Maps URLs to endpoints |
| **CORS** | All requests | Allows `localhost:3000` origin |
| **Authentication** | All requests | Validates Bearer tokens via OpenIddict |
| **Authorization** | `[Authorize]` endpoints | Rejects unauthenticated requests (401) |
| **Rate Limiter** | `/api/v1/*` | Enforces per-client sliding window limits |
| **Usage Logger** | `/api/v1/*` | Records request details to `ApiUsageLog` |

## Rate Limiting

```mermaid
graph LR
    subgraph Dev["Dev Environment"]
        D1["10 requests/min"]
        D2["Key expires: 30 days"]
        D3["Max 5 keys"]
    end

    subgraph Stage["Stage Environment"]
        S1["30 requests/min"]
        S2["Key expires: 90 days"]
        S3["Max 3 keys"]
    end

    subgraph Prod["Prod Environment"]
        P1["100 requests/min"]
        P2["Key never expires"]
        P3["Max 2 keys"]
    end

    style Dev fill:#854d0e,stroke:#ca8a04,color:#fef9c3
    style Stage fill:#1e3a5f,stroke:#3b82f6,color:#dbeafe
    style Prod fill:#14532d,stroke:#22c55e,color:#dcfce7
```

All rate limiters use a **sliding window** algorithm with 2 segments per minute, partitioned by `client_id` claim. When the limit is exceeded, the API returns:

```json
HTTP 429
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please wait and try again.",
  "retryAfter": 60
}
```

## API Key Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: POST /developers/{id}/keys
    Created --> Active: Immediate
    Active --> Rotated: POST .../keys/{id}/rotate
    Rotated --> Active: New secret issued
    Active --> Expired: ExpiresAt reached (Dev/Stage only)
    Active --> Deleted: DELETE .../keys/{id}
    Expired --> Deleted: DELETE .../keys/{id}
    Deleted --> [*]: OpenIddict app removed

    state Active {
        [*] --> TokenExchange: POST /connect/token
        TokenExchange --> ApiAccess: Bearer token
        ApiAccess --> RateLimited: Limit exceeded
        RateLimited --> ApiAccess: After cooldown
    }
```

## Frontend Architecture

```mermaid
graph TB
    subgraph Pages
        HomePage["/ (Home)<br/>Quote of the Day display"]
        DevPage["/developers<br/>Registration + Key Management"]
        DocsPage["/docs<br/>API documentation"]
        AdminPage["/admin<br/>System-wide analytics"]
    end

    subgraph Components
        DevReg["DevRegistration<br/>Register / Lookup by email"]
        KeyMgr["KeyManager<br/>Create, rotate, delete, test keys<br/>Grouped by Dev/Stage/Prod"]
        Usage["UsageStats<br/>Per-developer analytics<br/>Daily chart, by-key, by-endpoint"]
    end

    subgraph APIClient["lib/api.ts"]
        Quotes["getQuoteOfTheDay()<br/>getRandomQuote()<br/>getAllQuotes()"]
        DevAPI["registerDeveloper()<br/>lookupDeveloper()<br/>createApiKey()<br/>rotateApiKey()<br/>deleteApiKey()"]
        TokenAPI["getToken()<br/>callProtectedQuotes()"]
        UsageAPI["getDeveloperUsage()<br/>getAdminUsage()<br/>getAdminRecentLogs()"]
    end

    subgraph Proxy["next.config.ts Rewrites"]
        P1["/api/* -> http://localhost:5090"]
        P2["/connect/* -> http://localhost:5090"]
    end

    HomePage --> Quotes
    DevPage --> DevReg
    DevPage --> KeyMgr
    DevPage --> Usage
    AdminPage --> UsageAPI

    DevReg --> DevAPI
    KeyMgr --> DevAPI
    KeyMgr --> TokenAPI
    Usage --> UsageAPI
    Quotes --> P1
    DevAPI --> P1
    TokenAPI --> P2
    UsageAPI --> P1
```

## API Endpoints Reference

### Public (No Authentication)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/quotes/today` | Today's quote (rotates daily) |
| `GET` | `/api/quotes/random` | Random quote |
| `GET` | `/api/quotes?category=Life` | All quotes, optional filter |
| `GET` | `/api/quotes/categories` | List categories |

### Developer Self-Service (No Authentication)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/developers/register` | Register `{ name, email }` |
| `GET` | `/api/developers/lookup?email=...` | Find account by email |
| `GET` | `/api/developers/{id}` | Get profile + keys |
| `POST` | `/api/developers/{id}/keys` | Create key `{ environment, label }` |
| `GET` | `/api/developers/{id}/keys/{keyId}` | View key details + secret |
| `POST` | `/api/developers/{id}/keys/{keyId}/rotate` | Rotate secret |
| `DELETE` | `/api/developers/{id}/keys/{keyId}` | Delete key |
| `GET` | `/api/developers/{id}/usage?days=7` | Usage summary |
| `GET` | `/api/developers/{id}/usage/keys/{keyId}` | Per-key usage logs |

### Protected API (Bearer Token Required)

| Method | Endpoint | Rate Limited | Description |
|---|---|---|---|
| `GET` | `/api/v1/quotes/today` | Yes | Quote of the day with metadata |
| `GET` | `/api/v1/quotes/random` | Yes | Random quote with metadata |
| `GET` | `/api/v1/quotes?page=1&pageSize=10` | Yes | Paginated quotes |

### Admin (X-Admin-Key Header Required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/usage?days=7` | System-wide usage overview |
| `GET` | `/api/admin/usage/recent?count=50` | Recent API call feed |

## Project Structure

```
dotnet-auth-demo/
├── docs/
│   └── architecture.md              # This document
├── src/AuthDemo.Api/
│   ├── Controllers/
│   │   ├── ConnectController.cs      # OAuth2 token endpoint
│   │   ├── QuotesController.cs       # Public quotes (main app)
│   │   ├── ApiQuotesController.cs    # Protected quotes (3rd party)
│   │   ├── DevelopersController.cs   # Self-service registration & keys
│   │   └── UsageController.cs        # Usage analytics + admin
│   ├── Data/
│   │   └── ApplicationDbContext.cs   # EF Core context
│   ├── Middleware/
│   │   └── ApiUsageLoggingMiddleware.cs
│   ├── Models/
│   │   ├── Quote.cs
│   │   ├── Developer.cs
│   │   ├── ApiKey.cs                 # Includes KeyEnvironment enum
│   │   └── ApiUsageLog.cs
│   └── Program.cs                    # App configuration & seeding
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # Home - Quote display
│   │   ├── developers/page.tsx       # Developer portal
│   │   ├── admin/page.tsx            # Admin dashboard
│   │   ├── docs/page.tsx             # API documentation
│   │   ├── components/
│   │   │   ├── DevRegistration.tsx   # Register / lookup
│   │   │   ├── KeyManager.tsx        # Key CRUD + testing
│   │   │   └── UsageStats.tsx        # Developer analytics
│   │   └── lib/api.ts               # API client functions
│   └── next.config.ts               # Proxy rewrites
├── tests/AuthDemo.Api.Tests/
└── AuthDemo.sln
```

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | .NET 8 / ASP.NET Core | Web API framework |
| **OAuth2** | OpenIddict 5.8 | Token server + validation |
| **ORM** | EF Core 8 (InMemory) | Data access |
| **Rate Limiting** | ASP.NET Core Rate Limiting | Sliding window per client |
| **Frontend** | Next.js 16 + TypeScript | React SSR/CSR framework |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Bundler** | Turbopack | Next.js dev server |

## Security Notes

> This is a **demo application**. The following should be changed for production:

- Replace in-memory database with a persistent store (PostgreSQL, SQL Server)
- Replace hardcoded admin key (`super-admin-key-change-me`) with proper admin authentication
- Enable HTTPS enforcement (`DisableTransportSecurityRequirement` should be removed)
- Replace development signing/encryption certificates with production certificates
- Add input validation and CSRF protection to developer registration
- Implement proper secret hashing for API keys (currently stored in plaintext in ApiKey table)
- Add email verification for developer registration
- Restrict developer portal endpoints with authentication
