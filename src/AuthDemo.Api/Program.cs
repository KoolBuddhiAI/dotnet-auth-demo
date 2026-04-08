using System.Threading.RateLimiting;
using AuthDemo.Api.Data;
using AuthDemo.Api.Middleware;
using AuthDemo.Api.Models;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);

// === Database ===
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseInMemoryDatabase("AuthDemoDb"));

// === OpenIddict (OAuth2 server) ===
builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
               .UseDbContext<ApplicationDbContext>();
    })
    .AddServer(options =>
    {
        options.SetTokenEndpointUris("/connect/token")
               .SetIntrospectionEndpointUris("/connect/introspect");

        options.AllowClientCredentialsFlow();

        options.RegisterScopes("quotes.read");

        options.AddDevelopmentEncryptionCertificate()
               .AddDevelopmentSigningCertificate();

        options.UseAspNetCore()
               .EnableTokenEndpointPassthrough()
               .DisableTransportSecurityRequirement();
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// === Auth ===
builder.Services.AddAuthentication(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);
builder.Services.AddAuthorization();

// === Rate limiting ===
builder.Services.AddRateLimiter(options =>
{
    // Dev: 10 requests per minute
    options.AddPolicy("dev", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.User.FindFirst("client_id")?.Value ?? "anonymous",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 2,
            }));

    // Stage: 30 requests per minute
    options.AddPolicy("stage", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.User.FindFirst("client_id")?.Value ?? "anonymous",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 2,
            }));

    // Prod: 100 requests per minute
    options.AddPolicy("prod", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            context.User.FindFirst("client_id")?.Value ?? "anonymous",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 2,
            }));

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error = "rate_limit_exceeded",
            message = "Too many requests. Please wait and try again.",
            retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)
                ? retry.TotalSeconds : 60
        }, ct);
    };
});

// === CORS ===
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// === Seed quotes ===
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();

    if (!db.Quotes.Any())
    {
        db.Quotes.AddRange(
            new Quote { Id = 1, Text = "The only way to do great work is to love what you do.", Author = "Steve Jobs", Category = "Motivation" },
            new Quote { Id = 2, Text = "Innovation distinguishes between a leader and a follower.", Author = "Steve Jobs", Category = "Innovation" },
            new Quote { Id = 3, Text = "Stay hungry, stay foolish.", Author = "Steve Jobs", Category = "Motivation" },
            new Quote { Id = 4, Text = "Life is what happens when you're busy making other plans.", Author = "John Lennon", Category = "Life" },
            new Quote { Id = 5, Text = "The future belongs to those who believe in the beauty of their dreams.", Author = "Eleanor Roosevelt", Category = "Dreams" },
            new Quote { Id = 6, Text = "It is during our darkest moments that we must focus to see the light.", Author = "Aristotle", Category = "Perseverance" },
            new Quote { Id = 7, Text = "The purpose of our lives is to be happy.", Author = "Dalai Lama", Category = "Life" },
            new Quote { Id = 8, Text = "Get busy living or get busy dying.", Author = "Stephen King", Category = "Life" },
            new Quote { Id = 9, Text = "You only live once, but if you do it right, once is enough.", Author = "Mae West", Category = "Life" },
            new Quote { Id = 10, Text = "In the middle of every difficulty lies opportunity.", Author = "Albert Einstein", Category = "Perseverance" },
            new Quote { Id = 11, Text = "The best time to plant a tree was 20 years ago. The second best time is now.", Author = "Chinese Proverb", Category = "Motivation" },
            new Quote { Id = 12, Text = "An unexamined life is not worth living.", Author = "Socrates", Category = "Philosophy" },
            new Quote { Id = 13, Text = "Eighty percent of success is showing up.", Author = "Woody Allen", Category = "Success" },
            new Quote { Id = 14, Text = "Your time is limited, don't waste it living someone else's life.", Author = "Steve Jobs", Category = "Life" },
            new Quote { Id = 15, Text = "The mind is everything. What you think you become.", Author = "Buddha", Category = "Philosophy" },
            new Quote { Id = 16, Text = "Strive not to be a success, but rather to be of value.", Author = "Albert Einstein", Category = "Success" },
            new Quote { Id = 17, Text = "The best revenge is massive success.", Author = "Frank Sinatra", Category = "Success" },
            new Quote { Id = 18, Text = "I have not failed. I've just found 10,000 ways that won't work.", Author = "Thomas Edison", Category = "Perseverance" },
            new Quote { Id = 19, Text = "Believe you can and you're halfway there.", Author = "Theodore Roosevelt", Category = "Motivation" },
            new Quote { Id = 20, Text = "Everything you've ever wanted is on the other side of fear.", Author = "George Addair", Category = "Motivation" },
            new Quote { Id = 21, Text = "Act as if what you do makes a difference. It does.", Author = "William James", Category = "Motivation" },
            new Quote { Id = 22, Text = "What we achieve inwardly will change outer reality.", Author = "Plutarch", Category = "Philosophy" },
            new Quote { Id = 23, Text = "Success is not final, failure is not fatal: it is the courage to continue that counts.", Author = "Winston Churchill", Category = "Perseverance" },
            new Quote { Id = 24, Text = "Happiness is not something ready-made. It comes from your own actions.", Author = "Dalai Lama", Category = "Life" },
            new Quote { Id = 25, Text = "Well done is better than well said.", Author = "Benjamin Franklin", Category = "Success" },
            new Quote { Id = 26, Text = "The only impossible journey is the one you never begin.", Author = "Tony Robbins", Category = "Motivation" },
            new Quote { Id = 27, Text = "What you get by achieving your goals is not as important as what you become.", Author = "Zig Ziglar", Category = "Success" },
            new Quote { Id = 28, Text = "Simplicity is the ultimate sophistication.", Author = "Leonardo da Vinci", Category = "Innovation" },
            new Quote { Id = 29, Text = "If you want to lift yourself up, lift up someone else.", Author = "Booker T. Washington", Category = "Life" },
            new Quote { Id = 30, Text = "The secret of getting ahead is getting started.", Author = "Mark Twain", Category = "Motivation" }
        );
        db.SaveChanges();
    }
}

app.Urls.Add("https://localhost:7090");
app.Urls.Add("http://localhost:5090");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseApiUsageLogging();
app.MapControllers();

app.Run();

public partial class Program { }
