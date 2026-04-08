using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.EntityFrameworkCore.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);

// === OpenIddict 5.x — use your own DbContext with OpenIddict entities ===
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseInMemoryDatabase(nameof(ApplicationDbContext));
});

builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore();
    })
    .AddServer(options =>
    {
        options.SetAuthorizationEndpointUris("/connect/authorize")
               .SetTokenEndpointUris("/connect/token")
               .SetLogoutEndpointUris("/connect/logout")
               .SetIntrospectionEndpointUris("/connect/introspect");

        options.AllowAuthorizationCodeFlow()
               .AllowClientCredentialsFlow()
               .AllowRefreshTokenFlow();

        options.RegisterScopes(Scopes.Email, Scopes.Profile, Scopes.OpenId, "api.read", "api.write");

        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.RequireProofKeyForCodeExchange();

        options.UseAspNetCore()
               .EnableStatusCodePagesIntegration()
               .EnableAuthorizationEndpointPassthrough()
               .EnableLogoutEndpointPassthrough()
               .EnableTokenEndpointPassthrough()
               .DisableTransportSecurityRequirement();
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// === JWT Bearer (for API protection) ===
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://localhost:7090";
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = true,
            ValidateLifetime = true,
            ValidIssuer = "https://localhost:7090/",
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim("client_id", "m2m-client") ||
            ctx.User.HasClaim("scope", "admin")))
    .AddPolicy("ReadWriteOnly", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim("scope", "api.write") ||
            ctx.User.HasClaim("client_id", "m2m-client")));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// === Seed demo clients ===
using (var scope = app.Services.CreateScope())
{
    var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

    // M2M Client
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
            }
        });
    }

    // SPA Client
    if (await manager.FindByClientIdAsync("spa-client") is null)
    {
        await manager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = "spa-client",
            ConsentType = ConsentTypes.Explicit,
            DisplayName = "React SPA Demo",
            ClientType = ClientTypes.Public,
            RedirectUris = { new Uri("https://localhost:5173/callback") },
            PostLogoutRedirectUris = { new Uri("https://localhost:5173/") },
            Permissions =
            {
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Logout,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
            },
            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange,
            },
        });
    }
}

app.Urls.Add("https://localhost:7090");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStatusCodePagesWithReExecute("/error");
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// === Custom DbContext with OpenIddict 5.x entity types ===
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<OpenIddictEntityFrameworkCoreApplication> Applications => Set<OpenIddictEntityFrameworkCoreApplication>();
    public DbSet<OpenIddictEntityFrameworkCoreAuthorization> Authorizations => Set<OpenIddictEntityFrameworkCoreAuthorization>();
    public DbSet<OpenIddictEntityFrameworkCoreScope> Scopes => Set<OpenIddictEntityFrameworkCoreScope>();
    public DbSet<OpenIddictEntityFrameworkCoreToken> Tokens => Set<OpenIddictEntityFrameworkCoreToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict();
    }
}

// Partial Program for test project access
public partial class Program { }