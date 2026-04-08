# .NET Core Authentication Demo — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Demonstrate a .NET Core Web API with OpenIddict-based authentication supporting:
1. React SPA via Authorization Code + PKCE
2. M2M (Machine-to-Machine) via Client Credentials grant
3. Dynamic client registration — new apps can self-register and expose APIs

**Architecture:**
- ASP.NET Core 8 Web API acting as its own Authorization Server (OpenIddict)
- React 18 SPA with oidc-client-js for OIDC authentication
- In-memory OpenIddict stores (switchable to EF Core + SQLite for persistence)
- Token endpoint, discovery document, and interactive API explorer built-in

**Tech Stack:** .NET 8, OpenIddict (4.4/5.x), React 18 + Vite, oidc-client-js, xUnit

---

## Task 1: Scaffold .NET Solution Structure

**Objective:** Create the .NET 8 solution with API and test projects.

**Files:**
- Create: `dotnet-auth-demo.sln`
- Create: `src/AuthDemo.Api/AuthDemo.Api.csproj`
- Create: `src/AuthDemo.Api/Program.cs` (empty shell)
- Create: `tests/AuthDemo.Api.Tests/AuthDemo.Api.Tests.csproj`

**Step 1: Create solution and projects**

```bash
cd /root/.openclaw/workspace/WIP/dotnet-auth-demo
dotnet new sln -n AuthDemo
dotnet new webapi -n AuthDemo.Api -o src/AuthDemo.Api --framework net8.0
dotnet new xunit -n AuthDemo.Api.Tests -o tests/AuthDemo.Api.Tests --framework net8.0
dotnet sln add src/AuthDemo.Api/AuthDemo.Api.csproj
dotnet sln add tests/AuthDemo.Api.Tests/AuthDemo.Api.Tests.csproj
dotnet add tests/AuthDemo.Api.Tests/AuthDemo.Api.Tests.csproj reference src/AuthDemo.Api/AuthDemo.Api.csproj
```

**Step 2: Run to verify shell builds**

```bash
dotnet build
```

Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold .NET 8 solution structure"
```

---

## Task 2: Add OpenIddict Packages

**Objective:** Install OpenIddict and its dependencies.

**Files:**
- Modify: `src/AuthDemo.Api/AuthDemo.Api.csproj`

**Step 1: Add NuGet packages**

```bash
cd src/AuthDemo.Api
dotnet add package OpenIddict.AspNetCore --version 5.8.0
dotnet add package OpenIddict.EntityFrameworkCore --version 5.8.0
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer --version 8.0.0
dotnet add package Microsoft.EntityFrameworkCore.InMemory --version 8.0.0
```

**Step 2: Verify packages restored**

```bash
dotnet build
```

Expected: BUILD SUCCEEDED

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add OpenIddict and EF Core InMemory packages"
```

---

## Task 3: Configure OpenIddict in Program.cs

**Objective:** Wire up OpenIddict as the authorization server with in-memory token storage.

**Files:**
- Modify: `src/AuthDemo.Api/Program.cs`

**Step 1: Write complete Program.cs**

```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.EntityFrameworkCore.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);

// === OpenIddict with EF Core InMemory ===
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseInMemoryDatabase(nameof(ApplicationDbContext)));

builder.Services.AddOpenIddict()
    .UseCore()
    .UseEntityFrameworkCore()
    .EnableTokenEndpoint("/connect/token")
    .EnableAuthorizationEndpoint("/connect/authorize")
    .EnableDiscoveryEndpoint("/.well-known/openid-configuration")
    .EnableIntrospectionEndpoint("/connect/introspect")
    .AcceptAnonymousClients()
    .DisableTokenStorage() // Temp: using temporary tokens (swap for persistent in Task 6)
    .AddEphemeralSigningKey(); // Temp: swap for persistent key in Task 6

// === JWT Bearer (for API protection) ===
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Oidc:Authority"] ?? "https://localhost:7090";
        options.RequireHttpsMetadata = false; // Dev only
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = true,
            ValidateLifetime = true,
            ValidIssuer = "https://localhost:7090/",
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// === Seed a demo M2M client ===
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();

    var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

    if (await manager.FindByClientIdAsync("m2m-client") is null)
    {
        await manager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = "m2m-client",
            ClientSecret = "m2m-secret-unsafe-change-me",
            DisplayName = "Machine-to-Machine Demo Client",
            Permissions =
            {
                Permissions.GrantTypes.ClientCredentials,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Introspection,
            },
            Scopes = { Scopes.Email, Scopes.Profile, "api.read", "api.write" }
        });
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

**Step 2: Create ApplicationDbContext**

Create: `src/AuthDemo.Api/Data/ApplicationDbContext.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using OpenIddict.EntityFrameworkCore.Models;

namespace AuthDemo.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<OpenIddictApplication> Applications => Set<OpenIddictApplication>();
    public DbSet<OpenIddictAuthorization> Authorizations => Set<OpenIddictAuthorization>();
    public DbSet<OpenIddictScope> Scopes => Set<OpenIddictScope>();
    public DbSet<OpenIddictToken> Tokens => Set<OpenIddictToken>();
}
```

**Step 3: Create a minimal controller**

Create: `src/AuthDemo.Api/Controllers/AuthController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    [HttpGet("protected")]
    [Authorize]
    public IActionResult Protected() => Ok(new
    {
        message = "You are authenticated",
        user = User.Identity?.Name ?? "anonymous",
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpGet("public")]
    public IActionResult Public() => Ok(new { message = "Public endpoint" });
}
```

**Step 4: Verify build**

```bash
dotnet build src/AuthDemo.Api/AuthDemo.Api.csproj
```

Expected: BUILD SUCCEEDED

**Step 5: Commit**

```bash
git add .
git commit -m "feat: wire up OpenIddict as auth server with M2M client seed"
```

---

## Task 4: Test M2M Token Acquisition

**Objective:** Verify the Client Credentials flow works.

**Files:** (no new files — run curl commands)

**Step 1: Start the API server (background)**

```bash
cd src/AuthDemo.Api
dotnet run --urls "https://localhost:7090" &
sleep 5
```

**Step 2: Get discovery document**

```bash
curl -s https://localhost:7090/.well-known/openid-configuration | python3 -m json.tool
```

Expected: JSON with `token_endpoint`, `authorization_endpoint`

**Step 3: Request M2M token**

```bash
curl -s -X POST https://localhost:7090/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=m2m-client&client_secret=m2m-secret-unsafe-change-me&scope=api.read"
```

Expected: JSON with `access_token`, `expires_in`, `token_type`

**Step 4: Call protected endpoint with token**

```bash
TOKEN=$(curl -s -X POST https://localhost:7090/connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=m2m-client&client_secret=m2m-secret-unsafe-change-me&scope=api.read" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s https://localhost:7090/api/auth/protected \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `{"message":"You are authenticated","user":"anonymous","scope":"api.read"}`

**Step 5: Kill the dev server**

```bash
pkill -f "dotnet.*AuthDemo.Api"
```

**Step 6: Commit**

```bash
git add . && git commit -m "test: verify M2M client credentials flow end-to-end"
```

---

## Task 5: Scaffold React SPA with OIDC

**Objective:** Create a React app that authenticates users via Authorization Code + PKCE.

**Files:**
- Create: `src/AuthDemo.Spa/` (Vite + React + TypeScript)

**Step 1: Create React app**

```bash
cd /root/.openclaw/workspace/WIP/dotnet-auth-demo
npm create vite@latest src/AuthDemo.Spa -- --template react-ts
cd src/AuthDemo.Spa
npm install
npm install oidc-client-ts @vitejs/plugin-react
```

**Step 2: Create OIDC configuration**

Create: `src/AuthDemo.Spa/src/auth/oidcConfig.ts`

```typescript
import { UserManager, WebStorageStateStore, User } from "oidc-client-ts";

export const oidcConfig = {
  authority: "https://localhost:7090",
  client_id: "spa-client",
  redirect_uri: "https://localhost:5173/callback",
  post_logout_redirect_uri: "https://localhost:5173/",
  response_type: "code",
  scope: "openid profile email api.read",
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  loadUserInfo: true,
};

export const userManager = new UserManager(oidcConfig);

export const signIn = () => userManager.signinRedirect();
export const signOut = () => userManager.signoutRedirect();
export const getUser = (): Promise<User | null> => userManager.getUser();
export const getAccessToken = (): Promise<string | null> =>
  userManager.getUser().then(u => u?.access_token ?? null);
```

**Step 3: Create AuthCallback component**

Create: `src/AuthDemo.Spa/src/pages/AuthCallback.tsx`

```tsx
import { useEffect } from "react";
import { userManager } from "../auth/oidcConfig";

export function AuthCallback() {
  useEffect(() => {
    userManager.signinRedirectCallback().then(() => {
      window.location.href = "/";
    }).catch(err => {
      console.error("Callback error:", err);
      window.location.href = "/";
    });
  }, []);

  return <div>Loading...</div>;
}
```

**Step 4: Create ProtectedRoute component**

Create: `src/AuthDemo.Spa/src/components/ProtectedRoute.tsx`

```tsx
import { ReactNode, useEffect, useState } from "react";
import { User } from "oidc-client-ts";
import { getUser, signIn } from "../auth/oidcConfig";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    getUser().then(u => setUser(u));
  }, []);

  if (user === undefined) return <div>Loading...</div>;
  if (user === null) {
    signIn();
    return null;
  }

  return <>{children}</>;
}
```

**Step 5: Update App.tsx with routing**

Create: `src/AuthDemo.Spa/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthCallback } from "./pages/AuthCallback";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { signOut, getUser } from "./auth/oidcConfig";
import { useEffect, useState } from "react";
import { User } from "oidc-client-ts";

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [apiData, setApiData] = useState<string>("");

  useEffect(() => {
    getUser().then(setUser);
  }, []);

  const callApi = async (scope: string) => {
    const u = await getUser();
    const res = await fetch("https://localhost:7090/api/auth/protected", {
      headers: { Authorization: `Bearer ${u?.access_token}` },
    });
    setApiData(await res.text());
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.profile.name ?? user?.profile.email ?? "unknown"}</p>
      <p>Token expires: {user?.expires_at ? new Date(user.expires_at * 1000).toLocaleString() : "—"}</p>
      <button onClick={() => callApi("api.read")}>Call Protected API</button>
      <pre>{apiData}</pre>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

function Home() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>.NET Auth Demo</h1>
      <p>Machine-to-Machine + SPA Authentication with OpenIddict</p>
      <Link to="/dashboard">Go to Dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 6: Install React Router**

```bash
npm install react-router-dom
```

**Step 7: Verify dev server starts**

```bash
npm run dev &
sleep 3
curl -s http://localhost:5173 | head -5
pkill -f "vite"
```

Expected: HTML page rendered

**Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold React SPA with OIDC Authorization Code + PKCE"
```

---

## Task 6: Add SPA Client to OpenIddict + HTTPS Support

**Objective:** Register the SPA client in OpenIddict and enable HTTPS for the API.

**Files:**
- Modify: `src/AuthDemo.Api/Program.cs` (add SPA client to seed)
- Modify: `src/AuthDemo.Api/appsettings.json` (add Kestrel HTTPS config)

**Step 1: Update Program.cs — add SPA client descriptor**

Add inside the seed block, after the m2m-client creation:

```csharp
if (await manager.FindByClientIdAsync("spa-client") is null)
{
    await manager.CreateAsync(new OpenIddictApplicationDescriptor
    {
        ClientId = "spa-client",
        ConsentType = ConsentTypes.Explicit,
        DisplayName = "React SPA Demo",
        Type = ClientTypes.Public, // SPA — no secret
        RedirectUris = { new Uri("https://localhost:5173/callback") },
        PostLogoutRedirectUris = { new Uri("https://localhost:5173/") },
        Permissions =
        {
            Permissions.GrantTypes.AuthorizationCode,
            Permissions.GrantTypes.RefreshToken,
            Permissions.Endpoints.Authorization,
            Permissions.Endpoints.Token,
            Permissions.Endpoints.EndSession,
            Permissions.Scopes.Email,
            Permissions.Scopes.Profile,
            Permissions.Prefixes.Scope + "api.read",
            Permissions.Prefixes.Scope + "api.write",
        },
        Requirements =
        {
            Requirements.Features.ProofKeyForCodeExchange, // PKCE required for SPA
        },
    });
}
```

**Step 2: Update Program.cs — add RequirePKCE for all public clients**

In the OpenIddict builder chain, add:
```csharp
.RequireProofKeyForCodeExchange()
```

**Step 3: Add HTTPS redirect (dev)**

In Program.cs after `var app = builder.Build();`:
```csharp
app.Urls.Add("https://localhost:7090");
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: register SPA client with PKCE requirement in OpenIddict"
```

---

## Task 7: Build Dynamic Client Registration API

**Objective:** Expose an API endpoint that allows new M2M clients to self-register and get an API key / client secret.

**Files:**
- Create: `src/AuthDemo.Api/Controllers/ClientsController.cs`
- Create: `src/AuthDemo.Api/Models/ClientRegistrationRequest.cs`

**Step 1: Create request model**

Create: `src/AuthDemo.Api/Models/ClientRegistrationRequest.cs`

```csharp
namespace AuthDemo.Api.Models;

public class ClientRegistrationRequest
{
    public string Name { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new() { "api.read" };
}
```

**Step 2: Create ClientsController**

Create: `src/AuthDemo.Api/Controllers/ClientsController.cs`

```csharp
using AuthDemo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientsController : ControllerBase
{
    private readonly IOpenIddictApplicationManager _manager;
    private readonly ILogger<ClientsController> _logger;

    public ClientsController(IOpenIddictApplicationManager manager, ILogger<ClientsController> logger)
    {
        _manager = manager;
        _logger = logger;
    }

    // Register a new M2M client
    [HttpPost("register")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Register([FromBody] ClientRegistrationRequest request)
    {
        var clientId = $"client-{Guid.NewGuid():N}";
        var clientSecret = Convert.ToBase64String(Guid.NewGuid().ToByteArray()); // temporary secret

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = clientId,
            ClientSecret = clientSecret,
            DisplayName = request.Name,
            Permissions =
            {
                Permissions.GrantTypes.ClientCredentials,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Introspection,
            },
        };

        foreach (var scope in request.Scopes)
        {
            descriptor.Scopes.Add(scope);
        }

        await _manager.CreateAsync(descriptor);

        _logger.LogInformation("New M2M client registered: {ClientId}", clientId);

        return Ok(new
        {
            client_id = clientId,
            client_secret = clientSecret,
            message = "Store the secret securely — it cannot be retrieved later."
        });
    }

    // List all registered clients
    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> List()
    {
        var clients = await _manager.List().ToListAsync();
        var result = new List<object>();

        foreach (var client in clients)
        {
            if (client is null) continue;
            var descriptor = await _manager.GetDescriptorAsync(client);
            result.Add(new
            {
                client_id = await _manager.GetClientIdAsync(client),
                display_name = await _manager.GetDisplayNameAsync(client),
                type = descriptor?.Type.ToString() ?? "unknown",
            });
        }

        return Ok(result);
    }

    // Revoke a client
    [HttpDelete("{clientId}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Revoke(string clientId)
    {
        var client = await _manager.FindByClientIdAsync(clientId);
        if (client is null) return NotFound();

        await _manager.DeleteAsync(client);
        _logger.LogInformation("Client revoked: {ClientId}", clientId);
        return NoContent();
    }
}
```

**Step 3: Add AdminOnly policy in Program.cs**

Add after `AddAuthorization()`:

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy =>
        policy.RequireRole("admin"));
```

And update the seed to give the m2m-client an admin role — add to its permissions temporarily (or add a hardcoded admin check for the first demo):

Actually, for simplicity: update the seed m2m-client to include a role claim. But OpenIddict doesn't store roles in the client descriptor by default. Simpler approach: add a hardcoded check for a specific client ID as admin:

```csharp
// In ClientsController, after getting the user/client
if (!User.HasClaim("client_id", "m2m-client") && !User.IsInRole("admin"))
    return Forbid();
```

Better yet, create an "admin" policy that checks for a specific client_id or scope:

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim("client_id", "m2m-client") ||
            ctx.User.HasClaim("scope", "admin")));
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add dynamic M2M client registration API"
```

---

## Task 8: Write Integration Tests

**Objective:** Verify auth flows with xUnit tests.

**Files:**
- Create: `tests/AuthDemo.Api.Tests/AuthFlowTests.cs`
- Create: `tests/AuthDemo.Api.Tests/ClientRegistrationTests.cs`

**Step 1: Add test packages**

```bash
cd tests/AuthDemo.Api.Tests
dotnet add package Microsoft.AspNetCore.Mvc.Testing --version 8.0.0
dotnet add package Microsoft.Playwright --version 1.41.0
```

**Step 2: Write auth flow tests**

Create: `tests/AuthDemo.Api.Tests/AuthFlowTests.cs`

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace AuthDemo.Api.Tests;

public class AuthFlowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthFlowTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task PublicEndpoint_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/auth/public");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/auth/protected");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task M2M_TokenEndpoint_ReturnsAccessToken()
    {
        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", "m2m-client"),
            new KeyValuePair<string, string>("client_secret", "m2m-secret-unsafe-change-me"),
            new KeyValuePair<string, string>("scope", "api.read"),
        });

        var response = await _client.PostAsync("/connect/token", body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.TryGetProperty("access_token", out _));
        Assert.True(json.RootElement.TryGetProperty("expires_in", out var exp));
        Assert.True(exp.GetInt32() > 0);
    }

    [Fact]
    public async Task M2M_ProtectedEndpoint_WithValidToken_ReturnsOk()
    {
        // Get token
        var body = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", "m2m-client"),
            new KeyValuePair<string, string>("client_secret", "m2m-secret-unsafe-change-me"),
            new KeyValuePair<string, string>("scope", "api.read"),
        });
        var tokenRes = await _client.PostAsync("/connect/token", body);
        var tokenJson = JsonDocument.Parse(await tokenRes.Content.ReadAsStringAsync());
        var token = tokenJson.RootElement.GetProperty("access_token").GetString();

        // Call protected endpoint
        var apiRequest = new HttpRequestMessage(HttpMethod.Get, "/api/auth/protected");
        apiRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var apiRes = await _client.SendAsync(apiRequest);

        Assert.Equal(HttpStatusCode.OK, apiRes.StatusCode);
        var apiJson = JsonDocument.Parse(await apiRes.Content.ReadAsStringAsync());
        Assert.Equal("api.read", apiJson.RootElement.GetProperty("scope").GetString());
    }

    [Fact]
    public async Task DiscoveryEndpoint_ReturnsOpenIdConfiguration()
    {
        var response = await _client.GetAsync("/.well-known/openid-configuration");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.TryGetProperty("token_endpoint", out _));
        Assert.True(json.RootElement.TryGetProperty("authorization_endpoint", out _));
    }
}
```

**Step 3: Run tests**

```bash
dotnet test
```

Expected: 4 passed

**Step 4: Commit**

```bash
git add .
git commit -m "test: add integration tests for M2M auth flows"
```

---

## Task 9: Add API Scopes Demo Endpoint

**Objective:** Show different access levels based on scopes.

**Files:**
- Create: `src/AuthDemo.Api/Controllers/ResourcesController.cs`

**Step 1: Create ResourcesController**

Create: `src/AuthDemo.Api/Controllers/ResourcesController.cs`

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResourcesController : ControllerBase
{
    [HttpGet]
    [Authorize]
    public IActionResult GetAll() => Ok(new
    {
        resources = new[] { "resource-alpha", "resource-beta", "resource-gamma" },
        scopes_used = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpGet("{id}")]
    [Authorize(Policy = "ReadWriteOnly")]
    public IActionResult GetOne(string id) => Ok(new
    {
        id,
        data = $"Details for {id}",
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpPost]
    [Authorize(Policy = "ReadWriteOnly")]
    public IActionResult Create([FromBody] object payload) => Ok(new
    {
        message = "Resource created",
        payload,
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });
}
```

**Step 2: Add ReadWriteOnly policy in Program.cs**

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ReadWriteOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim("scope", "api.write") ||
            ctx.User.HasClaim("client_id", "m2m-client")));
```

**Step 3: Commit**

```bash
git add . && git commit -m "feat: add scoped resource endpoints for read/write demo"
```

---

## Task 10: Production-Ready Improvements

**Objective:** Swap ephemeral/dev defaults for production-grade defaults.

**Files:**
- Modify: `src/AuthDemo.Api/Program.cs`

**Changes:**

1. **Replace EphemeralSigningKey with RSA persistent key** (generated at startup or loaded from file):

```csharp
// Generate RSA key on first run, persist to disk
var keyFile = Path.Combine(env.ContentRootPath, "signing-key.xml");
RSA rsa = RSA.Create();
if (File.Exists(keyFile))
{
    rsa.ImportFromXmlFile(keyFile);
}
else
{
    rsa.KeySize = 2048;
    File.WriteAllText(keyFile, rsa.ExportRSAPrivateKeyXml());
}
builder.Services.AddSingleton(rsa);
```

In OpenIddict builder:
```csharp
.AddSigningKey(new RSASecurityKey(rsa))
```

2. **Replace DisableTokenStorage with persistent token storage** — already using EntityFrameworkCore + InMemory, just remove `.DisableTokenStorage()`.

3. **Add token lifetime configuration** (shorter access token, longer refresh):

```csharp
builder.Services.Configure<OpenIddictServerOptions>(options =>
{
    options.Token Lifetimes.AccessToken = TimeSpan.FromMinutes(15);
    options.TokenLifetimes.RefreshToken = TimeSpan.FromDays(7);
});
```

**Step 2: Commit**

```bash
git add . && git commit -m "feat: replace ephemeral dev keys with persistent RSA signing key"
```

---

## Summary of What Gets Built

```
dotnet-auth-demo/
├── src/
│   ├── AuthDemo.Api/           # .NET 8 Web API (OpenIddict server)
│   │   ├── Controllers/
│   │   │   ├── AuthController.cs        # /api/auth/protected, /public
│   │   │   ├── ClientsController.cs     # /api/clients (register, list, revoke)
│   │   │   └── ResourcesController.cs   # /api/resources (scoped endpoints)
│   │   ├── Data/
│   │   │   └── ApplicationDbContext.cs  # EF Core + OpenIddict models
│   │   ├── Models/
│   │   │   └── ClientRegistrationRequest.cs
│   │   └── Program.cs                   # OpenIddict + JWT + DI wiring
│   └── AuthDemo.Spa/        # React 18 + Vite SPA (oidc-client-ts)
│       ├── src/
│       │   ├── auth/oidcConfig.ts        # OIDC configuration
│       │   ├── components/ProtectedRoute.tsx
│       │   ├── pages/AuthCallback.tsx
│       │   └── App.tsx                   # Dashboard + Home pages
│       └── package.json
├── tests/
│   └── AuthDemo.Api.Tests/
│       └── AuthFlowTests.cs              # M2M + discovery endpoint tests
└── PLAN.md
```

### What each auth flow demonstrates

| Flow | Who | How | Endpoint |
|------|-----|-----|----------|
| **Client Credentials** | M2M / new app registering | POST `/connect/token` with `client_id` + `client_secret` | Protected API |
| **Authorization Code + PKCE** | React SPA user login | Redirect → callback → stored user | User-scoped API |
| **Dynamic Registration** | New M2M client | POST `/api/clients/register` (admin only) | Gets `client_id` + `client_secret` |
| **Token Introspection** | API validation | POST `/connect/introspect` | Validates token freshness |
| **Scopes** | Access control | `api.read` vs `api.write` | ReadWriteOnly policy |

---

**Plan complete. Ready to execute using subagent-driven-development — shall I proceed?**