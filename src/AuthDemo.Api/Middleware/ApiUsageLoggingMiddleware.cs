using System.Diagnostics;
using AuthDemo.Api.Data;
using AuthDemo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthDemo.Api.Middleware;

public class ApiUsageLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public ApiUsageLoggingMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Only log calls to the protected /api/v1/ endpoints
        if (!path.StartsWith("/api/v1/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        await _next(context);
        sw.Stop();

        var clientId = context.User.FindFirst("client_id")?.Value;
        if (string.IsNullOrEmpty(clientId)) return;

        // Resolve key info in a new scope to avoid DbContext lifetime issues
        using var scope = context.RequestServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var apiKey = await db.ApiKeys.FirstOrDefaultAsync(k => k.ClientId == clientId);

        var log = new ApiUsageLog
        {
            ClientId = clientId,
            Endpoint = path,
            Method = context.Request.Method,
            StatusCode = context.Response.StatusCode,
            Environment = apiKey?.Environment.ToString() ?? "unknown",
            ResponseTimeMs = sw.ElapsedMilliseconds,
            Timestamp = DateTime.UtcNow,
            ApiKeyId = apiKey?.Id,
            DeveloperId = apiKey?.DeveloperId,
        };

        db.ApiUsageLogs.Add(log);
        await db.SaveChangesAsync();
    }
}

public static class ApiUsageLoggingExtensions
{
    public static IApplicationBuilder UseApiUsageLogging(this IApplicationBuilder app)
        => app.UseMiddleware<ApiUsageLoggingMiddleware>();
}
