using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.EntityFrameworkCore.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;
using System.Collections.Immutable;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientsController : ControllerBase
{
    private readonly IOpenIddictApplicationManager _manager;

    public ClientsController(IOpenIddictApplicationManager manager)
    {
        _manager = manager;
    }

    /// <summary>
    /// List all registered OAuth2 clients.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> ListClients()
    {
        var clients = new List<object>();
        await foreach (var descriptor in _manager.ListAsync())
        {
            var clientId = await _manager.GetClientIdAsync(descriptor) ?? "";
            var displayName = await _manager.GetDisplayNameAsync(descriptor) ?? "";
            var clientType = await _manager.GetClientTypeAsync(descriptor);
            clients.Add(new { clientId, displayName, type = clientType });
        }
        return Ok(clients);
    }

    /// <summary>
    /// Get a specific client by ID.
    /// </summary>
    [HttpGet("{clientId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetClient(string clientId)
    {
        var descriptor = await _manager.FindByClientIdAsync(clientId);
        if (descriptor is null) return NotFound();

        return Ok(new
        {
            clientId = await _manager.GetClientIdAsync(descriptor) ?? "",
            displayName = await _manager.GetDisplayNameAsync(descriptor) ?? "",
            clientType = await _manager.GetClientTypeAsync(descriptor),
            consentType = await _manager.GetConsentTypeAsync(descriptor),
            redirectUris = (await _manager.GetRedirectUrisAsync(descriptor)).ToArray(),
            postLogoutRedirectUris = (await _manager.GetPostLogoutRedirectUrisAsync(descriptor)).ToArray(),
            permissions = (await _manager.GetPermissionsAsync(descriptor)).ToArray(),
        });
    }

    /// <summary>
    /// Dynamically register a new M2M client (for testing).
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterClient([FromBody] RegisterClientRequest request)
    {
        if (await _manager.FindByClientIdAsync(request.ClientId) is not null)
            return BadRequest(new { error = "client_id already exists" });

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = request.ClientId,
            ClientSecret = request.ClientSecret,
            DisplayName = request.DisplayName ?? request.ClientId,
            ClientType = string.IsNullOrEmpty(request.ClientSecret)
                ? ClientTypes.Public
                : ClientTypes.Confidential,
            Permissions =
            {
                Permissions.GrantTypes.ClientCredentials,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.Introspection,
            }
        };

        if (!string.IsNullOrEmpty(request.RedirectUri))
            descriptor.RedirectUris.Add(new Uri(request.RedirectUri));

        await _manager.CreateAsync(descriptor);
        return Created($"/api/clients/{request.ClientId}", new { clientId = request.ClientId });
    }

    /// <summary>
    /// Delete a client.
    /// </summary>
    [HttpDelete("{clientId}")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteClient(string clientId)
    {
        var descriptor = await _manager.FindByClientIdAsync(clientId);
        if (descriptor is null) return NotFound();

        await _manager.DeleteAsync(descriptor);
        return NoContent();
    }
}

public record RegisterClientRequest(
    string ClientId,
    string? ClientSecret,
    string? DisplayName,
    string? RedirectUri);