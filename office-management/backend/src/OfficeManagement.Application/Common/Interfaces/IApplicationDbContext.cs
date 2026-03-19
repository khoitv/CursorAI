using Microsoft.EntityFrameworkCore;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Department> Departments { get; }
    DbSet<Employee> Employees { get; }
    DbSet<OfficeLayout> OfficeLayouts { get; }
    DbSet<Room> Rooms { get; }
    DbSet<Table> Tables { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
