using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResourcesController : ControllerBase
{
    [HttpGet]
    [Authorize]
    public IActionResult GetAll() => Ok(new
    {
        resources = new[] { "resource-alpha", "resource-beta", "resource-gamma" },
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpGet("{id}")]
    [Authorize(Policy = "ReadWriteOnly")]
    public IActionResult GetOne(string id) => Ok(new
    {
        id,
        data = $"Details for {id}",
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpPost]
    [Authorize(Policy = "ReadWriteOnly")]
    public IActionResult Create([FromBody] object payload) => Ok(new
    {
        message = "Resource created",
        payload,
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });
}