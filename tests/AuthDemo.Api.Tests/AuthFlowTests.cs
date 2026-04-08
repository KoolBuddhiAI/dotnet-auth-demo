using System.Net;
using System.Net.Http.Headers;
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
    public async Task DiscoveryEndpoint_ReturnsOpenIdConfiguration()
    {
        var response = await _client.GetAsync("/.well-known/openid-configuration");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(json.RootElement.TryGetProperty("token_endpoint", out _));
        Assert.True(json.RootElement.TryGetProperty("authorization_endpoint", out _));
    }
}