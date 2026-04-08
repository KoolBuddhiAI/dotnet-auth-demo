namespace AuthDemo.Api.Models;

public enum KeyEnvironment
{
    Dev,
    Stage,
    Prod
}

public class ApiKey
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public KeyEnvironment Environment { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Guid DeveloperId { get; set; }
    public Developer Developer { get; set; } = null!;
}
