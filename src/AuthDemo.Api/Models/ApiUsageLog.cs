namespace AuthDemo.Api.Models;

public class ApiUsageLog
{
    public long Id { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string Environment { get; set; } = string.Empty;
    public long ResponseTimeMs { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public Guid? ApiKeyId { get; set; }
    public Guid? DeveloperId { get; set; }
}
