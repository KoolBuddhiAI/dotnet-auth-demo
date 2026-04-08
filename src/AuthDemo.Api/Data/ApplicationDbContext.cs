using Microsoft.EntityFrameworkCore;
using OpenIddict.EntityFrameworkCore.Models;

namespace AuthDemo.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<OpenIddictEntityFrameworkCoreApplication> Applications => Set<OpenIddictEntityFrameworkCoreApplication>();
    public DbSet<OpenIddictEntityFrameworkCoreAuthorization> Authorizations => Set<OpenIddictEntityFrameworkCoreAuthorization>();
    public DbSet<OpenIddictEntityFrameworkCoreScope> Scopes => Set<OpenIddictEntityFrameworkCoreScope>();
    public DbSet<OpenIddictEntityFrameworkCoreToken> Tokens => Set<OpenIddictEntityFrameworkCoreToken>();
}