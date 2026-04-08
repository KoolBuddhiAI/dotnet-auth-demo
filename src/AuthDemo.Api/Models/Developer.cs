namespace AuthDemo.Api.Models;

public class Developer
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;

    public List<ApiKey> ApiKeys { get; set; } = new();
}
