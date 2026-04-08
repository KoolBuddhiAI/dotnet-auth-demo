using AuthDemo.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/developers/{developerId:guid}/usage")]
public class UsageController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public UsageController(ApplicationDbContext db) => _db = db;

    /// <summary>Get usage summary for a developer across all their keys.</summary>
    [HttpGet]
    public async Task<IActionResult> GetUsageSummary(Guid developerId, [FromQuery] int days = 7)
    {
        var dev = await _db.Developers.FirstOrDefaultAsync(d => d.Id == developerId);
        if (dev == null) return NotFound(new { error = "Developer not found." });

        var since = DateTime.UtcNow.AddDays(-days);

        var logs = await _db.ApiUsageLogs
            .Where(l => l.DeveloperId == developerId && l.Timestamp >= since)
            .ToListAsync();

        var byKey = logs
            .GroupBy(l => new { l.ApiKeyId, l.ClientId, l.Environment })
            .Select(g => new
            {
                keyId = g.Key.ApiKeyId,
                clientId = g.Key.ClientId,
                environment = g.Key.Environment,
                totalRequests = g.Count(),
                successCount = g.Count(l => l.StatusCode >= 200 && l.StatusCode < 300),
                errorCount = g.Count(l => l.StatusCode >= 400),
                avgResponseMs = Math.Round(g.Average(l => l.ResponseTimeMs), 1),
            })
            .OrderByDescending(x => x.totalRequests)
            .ToList();

        var byEndpoint = logs
            .GroupBy(l => new { l.Method, l.Endpoint })
            .Select(g => new
            {
                method = g.Key.Method,
                endpoint = g.Key.Endpoint,
                count = g.Count(),
            })
            .OrderByDescending(x => x.count)
            .ToList();

        var byDay = logs
            .GroupBy(l => l.Timestamp.Date)
            .Select(g => new
            {
                date = g.Key.ToString("yyyy-MM-dd"),
                count = g.Count(),
            })
            .OrderBy(x => x.date)
            .ToList();

        return Ok(new
        {
            developerId,
            period = new { days, since = since.ToString("yyyy-MM-dd") },
            totalRequests = logs.Count,
            byKey,
            byEndpoint,
            byDay,
        });
    }

    /// <summary>Get detailed usage logs for a specific key.</summary>
    [HttpGet("keys/{keyId:guid}")]
    public async Task<IActionResult> GetKeyUsage(Guid developerId, Guid keyId, [FromQuery] int days = 7, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.DeveloperId == developerId);
        if (key == null) return NotFound(new { error = "Key not found." });

        var since = DateTime.UtcNow.AddDays(-days);
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = _db.ApiUsageLogs
            .Where(l => l.ApiKeyId == keyId && l.Timestamp >= since)
            .OrderByDescending(l => l.Timestamp);

        var total = await query.CountAsync();
        var logs = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                l.Endpoint,
                l.Method,
                l.StatusCode,
                l.ResponseTimeMs,
                l.Timestamp,
            })
            .ToListAsync();

        return Ok(new
        {
            keyId,
            clientId = key.ClientId,
            environment = key.Environment.ToString(),
            period = new { days, since = since.ToString("yyyy-MM-dd") },
            total,
            page,
            pageSize,
            logs,
        });
    }
}

/// <summary>Super admin endpoint to see all API usage.</summary>
[ApiController]
[Route("api/admin/usage")]
public class AdminUsageController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AdminUsageController(ApplicationDbContext db) => _db = db;

    /// <summary>
    /// Get system-wide usage overview. In production, this should require admin auth.
    /// For this demo, it's protected by a simple admin key header.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetSystemUsage(
        [FromHeader(Name = "X-Admin-Key")] string? adminKey,
        [FromQuery] int days = 7)
    {
        if (adminKey != "super-admin-key-change-me")
            return Unauthorized(new { error = "Invalid or missing X-Admin-Key header." });

        var since = DateTime.UtcNow.AddDays(-days);

        var logs = await _db.ApiUsageLogs
            .Where(l => l.Timestamp >= since)
            .ToListAsync();

        var developers = await _db.Developers.Include(d => d.ApiKeys).ToListAsync();

        var byDeveloper = logs
            .GroupBy(l => l.DeveloperId)
            .Select(g =>
            {
                var dev = developers.FirstOrDefault(d => d.Id == g.Key);
                return new
                {
                    developerId = g.Key,
                    developerName = dev?.Name ?? "Unknown",
                    developerEmail = dev?.Email ?? "Unknown",
                    totalRequests = g.Count(),
                    successCount = g.Count(l => l.StatusCode >= 200 && l.StatusCode < 300),
                    errorCount = g.Count(l => l.StatusCode >= 400),
                    avgResponseMs = Math.Round(g.Average(l => l.ResponseTimeMs), 1),
                    keyCount = dev?.ApiKeys.Count ?? 0,
                };
            })
            .OrderByDescending(x => x.totalRequests)
            .ToList();

        var byEnvironment = logs
            .GroupBy(l => l.Environment)
            .Select(g => new
            {
                environment = g.Key,
                totalRequests = g.Count(),
                avgResponseMs = Math.Round(g.Average(l => l.ResponseTimeMs), 1),
                uniqueClients = g.Select(l => l.ClientId).Distinct().Count(),
            })
            .ToList();

        var byEndpoint = logs
            .GroupBy(l => new { l.Method, l.Endpoint })
            .Select(g => new
            {
                method = g.Key.Method,
                endpoint = g.Key.Endpoint,
                count = g.Count(),
                avgResponseMs = Math.Round(g.Average(l => l.ResponseTimeMs), 1),
            })
            .OrderByDescending(x => x.count)
            .ToList();

        var byDay = logs
            .GroupBy(l => l.Timestamp.Date)
            .Select(g => new
            {
                date = g.Key.ToString("yyyy-MM-dd"),
                count = g.Count(),
                uniqueClients = g.Select(l => l.ClientId).Distinct().Count(),
            })
            .OrderBy(x => x.date)
            .ToList();

        var byHour = logs
            .Where(l => l.Timestamp.Date == DateTime.UtcNow.Date)
            .GroupBy(l => l.Timestamp.Hour)
            .Select(g => new
            {
                hour = g.Key,
                count = g.Count(),
            })
            .OrderBy(x => x.hour)
            .ToList();

        return Ok(new
        {
            period = new { days, since = since.ToString("yyyy-MM-dd") },
            totalRequests = logs.Count,
            totalDevelopers = developers.Count,
            totalKeys = developers.Sum(d => d.ApiKeys.Count),
            byDeveloper,
            byEnvironment,
            byEndpoint,
            byDay,
            todayByHour = byHour,
        });
    }

    /// <summary>Get recent log entries (real-time feed).</summary>
    [HttpGet("recent")]
    public async Task<IActionResult> GetRecentLogs(
        [FromHeader(Name = "X-Admin-Key")] string? adminKey,
        [FromQuery] int count = 50)
    {
        if (adminKey != "super-admin-key-change-me")
            return Unauthorized(new { error = "Invalid or missing X-Admin-Key header." });

        count = Math.Clamp(count, 1, 200);

        var logs = await _db.ApiUsageLogs
            .OrderByDescending(l => l.Timestamp)
            .Take(count)
            .Select(l => new
            {
                l.ClientId,
                l.Endpoint,
                l.Method,
                l.StatusCode,
                l.Environment,
                l.ResponseTimeMs,
                l.Timestamp,
                l.DeveloperId,
            })
            .ToListAsync();

        return Ok(new { count = logs.Count, logs });
    }
}
