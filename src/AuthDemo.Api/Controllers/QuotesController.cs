using AuthDemo.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthDemo.Api.Controllers;

/// <summary>
/// Public quotes endpoints — used by the main app, no auth required.
/// </summary>
[ApiController]
[Route("api/quotes")]
public class QuotesController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public QuotesController(ApplicationDbContext db) => _db = db;

    [HttpGet("today")]
    public async Task<IActionResult> GetToday()
    {
        var dayOfYear = DateTime.UtcNow.DayOfYear;
        var count = await _db.Quotes.CountAsync();
        if (count == 0) return NotFound(new { error = "No quotes available" });

        var index = dayOfYear % count;
        var quote = await _db.Quotes.OrderBy(q => q.Id).Skip(index).FirstAsync();
        return Ok(new { quote.Text, quote.Author, quote.Category, date = DateTime.UtcNow.ToString("yyyy-MM-dd") });
    }

    [HttpGet("random")]
    public async Task<IActionResult> GetRandom()
    {
        var count = await _db.Quotes.CountAsync();
        if (count == 0) return NotFound(new { error = "No quotes available" });

        var index = Random.Shared.Next(count);
        var quote = await _db.Quotes.OrderBy(q => q.Id).Skip(index).FirstAsync();
        return Ok(new { quote.Text, quote.Author, quote.Category });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? category = null)
    {
        var query = _db.Quotes.AsQueryable();
        if (!string.IsNullOrEmpty(category))
            query = query.Where(q => q.Category == category);

        var quotes = await query.OrderBy(q => q.Id)
            .Select(q => new { q.Id, q.Text, q.Author, q.Category })
            .ToListAsync();
        return Ok(new { count = quotes.Count, quotes });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _db.Quotes
            .Select(q => q.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();
        return Ok(categories);
    }
}
