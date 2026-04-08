using System.Security.Claims;
using AuthDemo.Api.Data;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace AuthDemo.Api.Controllers;

[ApiController]
public class ConnectController : ControllerBase
{
    private readonly IOpenIddictApplicationManager _appManager;
    private readonly ApplicationDbContext _db;

    public ConnectController(IOpenIddictApplicationManager appManager, ApplicationDbContext db)
    {
        _appManager = appManager;
        _db = db;
    }

    [HttpPost("~/connect/token")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (!request.IsClientCredentialsGrantType())
        {
            return BadRequest(new OpenIddictResponse
            {
                Error = Errors.UnsupportedGrantType,
                ErrorDescription = "Only client_credentials grant type is supported."
            });
        }

        var application = await _appManager.FindByClientIdAsync(request.ClientId!)
            ?? throw new InvalidOperationException("The application cannot be found.");

        var identity = new ClaimsIdentity(
            authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            nameType: Claims.Name,
            roleType: Claims.Role);

        var clientId = await _appManager.GetClientIdAsync(application);
        var displayName = await _appManager.GetDisplayNameAsync(application);

        identity.SetClaim(Claims.Subject, clientId);
        identity.SetClaim(Claims.Name, displayName);

        // Embed environment claim from our ApiKey record
        var apiKey = await _db.ApiKeys.FirstOrDefaultAsync(k => k.ClientId == clientId);
        if (apiKey != null)
        {
            var env = apiKey.Environment.ToString().ToLowerInvariant();
            identity.SetClaim("env", env);

            // Check if key is expired
            if (apiKey.ExpiresAt.HasValue && apiKey.ExpiresAt < DateTime.UtcNow)
            {
                return BadRequest(new OpenIddictResponse
                {
                    Error = Errors.InvalidClient,
                    ErrorDescription = "This API key has expired. Please create a new key or rotate the existing one."
                });
            }

            if (!apiKey.IsActive)
            {
                return BadRequest(new OpenIddictResponse
                {
                    Error = Errors.InvalidClient,
                    ErrorDescription = "This API key has been deactivated."
                });
            }
        }

        identity.SetDestinations(static claim => claim.Type switch
        {
            Claims.Name or Claims.Subject => [Destinations.AccessToken, Destinations.IdentityToken],
            _ => [Destinations.AccessToken]
        });

        return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}
