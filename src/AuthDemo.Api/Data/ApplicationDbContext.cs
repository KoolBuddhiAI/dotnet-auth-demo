using AuthDemo.Api.Models;
using Microsoft.EntityFrameworkCore;
using OpenIddict.EntityFrameworkCore.Models;

namespace AuthDemo.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<Developer> Developers => Set<Developer>();
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();

    public DbSet<OpenIddictEntityFrameworkCoreApplication> OpenIddictApplications => Set<OpenIddictEntityFrameworkCoreApplication>();
    public DbSet<OpenIddictEntityFrameworkCoreAuthorization> OpenIddictAuthorizations => Set<OpenIddictEntityFrameworkCoreAuthorization>();
    public DbSet<OpenIddictEntityFrameworkCoreScope> OpenIddictScopes => Set<OpenIddictEntityFrameworkCoreScope>();
    public DbSet<OpenIddictEntityFrameworkCoreToken> OpenIddictTokens => Set<OpenIddictEntityFrameworkCoreToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict();

        builder.Entity<Developer>(e =>
        {
            e.HasIndex(d => d.Email).IsUnique();
            e.HasMany(d => d.ApiKeys).WithOne(k => k.Developer).HasForeignKey(k => k.DeveloperId);
        });

        builder.Entity<ApiKey>(e =>
        {
            e.HasIndex(k => k.ClientId).IsUnique();
        });
    }
}
