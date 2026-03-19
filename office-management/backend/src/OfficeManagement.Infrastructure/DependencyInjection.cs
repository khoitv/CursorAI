using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Infrastructure.Persistence;

namespace OfficeManagement.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var useInMemory = configuration.GetValue<bool>("UseInMemoryDatabase");
        if (useInMemory)
            services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("OfficeManagementDb"));
        else
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? "Server=(localdb)\\mssqllocaldb;Database=OfficeManagement;Trusted_Connection=True;MultipleActiveResultSets=true";
            services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
        }
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());
        return services;
    }
}
