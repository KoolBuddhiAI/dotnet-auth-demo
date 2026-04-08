using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthDemo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    [HttpGet("protected")]
    [Authorize]
    public IActionResult Protected() => Ok(new
    {
        message = "You are authenticated",
        user = User.Identity?.Name ?? "anonymous",
        scope = User.Claims.FirstOrDefault(c => c.Type == "scope")?.Value
    });

    [HttpGet("public")]
    public IActionResult Public() => Ok(new { message = "Public endpoint" });
}