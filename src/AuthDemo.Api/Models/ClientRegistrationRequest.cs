namespace AuthDemo.Api.Models;

public class ClientRegistrationRequest
{
    public string Name { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new() { "api.read" };
}