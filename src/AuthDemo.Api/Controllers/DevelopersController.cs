using System.Security.Cryptography;
using AuthDemo.Api.Data;
using AuthDemo.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/developers")]
public class DevelopersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IOpenIddictApplicationManager _appManager;

    public DevelopersController(ApplicationDbContext db, IOpenIddictApplicationManager appManager)
    {
        _db = db;
        _appManager = appManager;
    }

    /// <summary>Register a new developer account.</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { error = "Name and email are required." });

        var existing = await _db.Developers.FirstOrDefaultAsync(d => d.Email == req.Email);
        if (existing != null)
            return Conflict(new { error = "A developer with this email already exists.", developerId = existing.Id });

        var dev = new Developer
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            Email = req.Email,
            RegisteredAt = DateTime.UtcNow,
        };
        _db.Developers.Add(dev);
        await _db.SaveChangesAsync();

        return Created($"/api/developers/{dev.Id}", new
        {
            dev.Id,
            dev.Name,
            dev.Email,
            dev.RegisteredAt,
            message = "Registration successful. Create API keys to start using the Quotes API."
        });
    }

    /// <summary>Look up a developer by email (to recover account).</summary>
    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string email)
    {
        var dev = await _db.Developers
            .Include(d => d.ApiKeys)
            .FirstOrDefaultAsync(d => d.Email == email);

        if (dev == null)
            return NotFound(new { error = "No developer found with this email." });

        return Ok(ToDeveloperResponse(dev));
    }

    /// <summary>Get developer profile and their keys.</summary>
    [HttpGet("{developerId:guid}")]
    public async Task<IActionResult> GetDeveloper(Guid developerId)
    {
        var dev = await _db.Developers
            .Include(d => d.ApiKeys)
            .FirstOrDefaultAsync(d => d.Id == developerId);

        if (dev == null) return NotFound(new { error = "Developer not found." });
        return Ok(ToDeveloperResponse(dev));
    }

    /// <summary>Create a new API key for a specific environment.</summary>
    [HttpPost("{developerId:guid}/keys")]
    public async Task<IActionResult> CreateKey(Guid developerId, [FromBody] CreateKeyRequest req)
    {
        var dev = await _db.Developers.Include(d => d.ApiKeys).FirstOrDefaultAsync(d => d.Id == developerId);
        if (dev == null) return NotFound(new { error = "Developer not found." });

        if (!Enum.TryParse<KeyEnvironment>(req.Environment, true, out var env))
            return BadRequest(new { error = "Environment must be one of: Dev, Stage, Prod." });

        // Dev keys: max 5, expire in 30 days. Stage: max 3, expire in 90 days. Prod: max 2, no expiry.
        var envKeys = dev.ApiKeys.Count(k => k.Environment == env && k.IsActive);
        var (maxKeys, expiresAt) = env switch
        {
            KeyEnvironment.Dev => (5, (DateTime?)DateTime.UtcNow.AddDays(30)),
            KeyEnvironment.Stage => (3, (DateTime?)DateTime.UtcNow.AddDays(90)),
            KeyEnvironment.Prod => (2, null),
            _ => (1, (DateTime?)DateTime.UtcNow.AddDays(30))
        };

        if (envKeys >= maxKeys)
            return BadRequest(new { error = $"Maximum {maxKeys} active {env} keys allowed. Delete an existing key first." });

        var clientId = $"{dev.Email.Split('@')[0]}-{env.ToString().ToLower()}-{Guid.NewGuid().ToString()[..8]}";
        var clientSecret = GenerateSecret();

        // Register as OpenIddict application
        await _appManager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = clientId,
            ClientSecret = clientSecret,
            DisplayName = $"{dev.Name} ({env} - {req.Label})",
            Permissions =
            {
                Permissions.GrantTypes.ClientCredentials,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Introspection,
                Permissions.Prefixes.Scope + "quotes.read",
            }
        });

        var apiKey = new ApiKey
        {
            Id = Guid.NewGuid(),
            Label = string.IsNullOrWhiteSpace(req.Label) ? $"{env} Key" : req.Label,
            Environment = env,
            ClientId = clientId,
            ClientSecret = clientSecret,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            IsActive = true,
            DeveloperId = developerId,
        };
        _db.ApiKeys.Add(apiKey);
        await _db.SaveChangesAsync();

        return Created($"/api/developers/{developerId}/keys/{apiKey.Id}", new
        {
            apiKey.Id,
            apiKey.Label,
            environment = apiKey.Environment.ToString(),
            apiKey.ClientId,
            apiKey.ClientSecret,
            apiKey.CreatedAt,
            apiKey.ExpiresAt,
            rateLimits = GetRateLimits(env),
            message = "Save your client secret — you can view it later or rotate it if compromised."
        });
    }

    /// <summary>View key details including the secret.</summary>
    [HttpGet("{developerId:guid}/keys/{keyId:guid}")]
    public async Task<IActionResult> GetKey(Guid developerId, Guid keyId)
    {
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.DeveloperId == developerId);
        if (key == null) return NotFound(new { error = "Key not found." });

        return Ok(new
        {
            key.Id,
            key.Label,
            environment = key.Environment.ToString(),
            key.ClientId,
            key.ClientSecret,
            key.CreatedAt,
            key.ExpiresAt,
            key.IsActive,
            isExpired = key.ExpiresAt.HasValue && key.ExpiresAt < DateTime.UtcNow,
            rateLimits = GetRateLimits(key.Environment),
        });
    }

    /// <summary>Rotate (regenerate) the secret for a key.</summary>
    [HttpPost("{developerId:guid}/keys/{keyId:guid}/rotate")]
    public async Task<IActionResult> RotateKey(Guid developerId, Guid keyId)
    {
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.DeveloperId == developerId);
        if (key == null) return NotFound(new { error = "Key not found." });

        var newSecret = GenerateSecret();

        // Update OpenIddict application secret
        var oidcApp = await _appManager.FindByClientIdAsync(key.ClientId);
        if (oidcApp != null)
        {
            var descriptor = new OpenIddictApplicationDescriptor();
            await _appManager.PopulateAsync(descriptor, oidcApp);
            descriptor.ClientSecret = newSecret;
            await _appManager.UpdateAsync(oidcApp, descriptor);
        }

        key.ClientSecret = newSecret;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            key.Id,
            key.ClientId,
            clientSecret = newSecret,
            rotatedAt = DateTime.UtcNow,
            message = "Secret rotated successfully. Old tokens will remain valid until they expire. Update your application with the new secret."
        });
    }

    /// <summary>Deactivate and delete a key.</summary>
    [HttpDelete("{developerId:guid}/keys/{keyId:guid}")]
    public async Task<IActionResult> DeleteKey(Guid developerId, Guid keyId)
    {
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.DeveloperId == developerId);
        if (key == null) return NotFound(new { error = "Key not found." });

        // Remove OpenIddict application
        var oidcApp = await _appManager.FindByClientIdAsync(key.ClientId);
        if (oidcApp != null)
            await _appManager.DeleteAsync(oidcApp);

        _db.ApiKeys.Remove(key);
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Key '{key.Label}' deleted. Any tokens issued with this key will no longer work." });
    }

    private static string GenerateSecret()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static object GetRateLimits(KeyEnvironment env) => env switch
    {
        KeyEnvironment.Dev => new { requestsPerMinute = 10, tokenTtlHours = 1, maxKeys = 5, expiresInDays = 30 },
        KeyEnvironment.Stage => new { requestsPerMinute = 30, tokenTtlHours = 4, maxKeys = 3, expiresInDays = 90 },
        KeyEnvironment.Prod => new { requestsPerMinute = 100, tokenTtlHours = 24, maxKeys = 2, expiresInDays = (int?)null },
        _ => new { requestsPerMinute = 10, tokenTtlHours = 1, maxKeys = 1, expiresInDays = (int?)30 },
    };

    private static object ToDeveloperResponse(Developer dev) => new
    {
        dev.Id,
        dev.Name,
        dev.Email,
        dev.RegisteredAt,
        keys = dev.ApiKeys.Select(k => new
        {
            k.Id,
            k.Label,
            environment = k.Environment.ToString(),
            k.ClientId,
            k.ClientSecret,
            k.CreatedAt,
            k.ExpiresAt,
            k.IsActive,
            isExpired = k.ExpiresAt.HasValue && k.ExpiresAt < DateTime.UtcNow,
        }).ToList(),
    };
}

public record RegisterRequest(string Name, string Email);
public record CreateKeyRequest(string Environment, string Label);
