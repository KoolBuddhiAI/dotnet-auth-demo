using AuthDemo.Api.Data;
using AuthDemo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AuthDemo.Api.Controllers;

/// <summary>
/// Protected quotes API for 3rd-party developers. Requires a valid access token.
/// Rate limited based on the key's environment (dev/stage/prod).
/// </summary>
[ApiController]
[Route("api/v1/quotes")]
[Authorize]
public class ApiQuotesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public ApiQuotesController(ApplicationDbContext db) => _db = db;

    [HttpGet("today")]
    [EnableRateLimiting("dev")]
    public async Task<IActionResult> GetToday()
    {
        var policy = await GetRateLimitPolicy();
        if (policy != "dev") HttpContext.Features.Set<IRateLimiterPolicy<string>>(null);

        var dayOfYear = DateTime.UtcNow.DayOfYear;
        var count = await _db.Quotes.CountAsync();
        if (count == 0) return NotFound(new { error = "No quotes available" });

        var index = dayOfYear % count;
        var quote = await _db.Quotes.OrderBy(q => q.Id).Skip(index).FirstAsync();
        return Ok(new
        {
            quote.Text,
            quote.Author,
            quote.Category,
            date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            _meta = new { environment = policy, source = "QuoteOfTheDay API v1" }
        });
    }

    [HttpGet("random")]
    public async Task<IActionResult> GetRandom()
    {
        var count = await _db.Quotes.CountAsync();
        if (count == 0) return NotFound(new { error = "No quotes available" });

        var index = Random.Shared.Next(count);
        var quote = await _db.Quotes.OrderBy(q => q.Id).Skip(index).FirstAsync();
        var policy = await GetRateLimitPolicy();
        return Ok(new
        {
            quote.Text,
            quote.Author,
            quote.Category,
            _meta = new { environment = policy, source = "QuoteOfTheDay API v1" }
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        pageSize = Math.Clamp(pageSize, 1, 50);
        page = Math.Max(1, page);

        var query = _db.Quotes.AsQueryable();
        if (!string.IsNullOrEmpty(category))
            query = query.Where(q => q.Category == category);

        var total = await query.CountAsync();
        var quotes = await query.OrderBy(q => q.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(q => new { q.Id, q.Text, q.Author, q.Category })
            .ToListAsync();

        var policy = await GetRateLimitPolicy();
        return Ok(new
        {
            total,
            page,
            pageSize,
            quotes,
            _meta = new { environment = policy, source = "QuoteOfTheDay API v1" }
        });
    }

    private async Task<string> GetRateLimitPolicy()
    {
        var clientId = User.FindFirst("client_id")?.Value;
        if (string.IsNullOrEmpty(clientId)) return "dev";

        var apiKey = await _db.ApiKeys.FirstOrDefaultAsync(k => k.ClientId == clientId);
        return apiKey?.Environment.ToString().ToLowerInvariant() ?? "dev";
    }
}
