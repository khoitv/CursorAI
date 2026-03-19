using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<OfficeLayout> OfficeLayouts => Set<OfficeLayout>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Table> Tables => Set<Table>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<Department>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Code).HasMaxLength(50);
        });
        builder.Entity<OfficeLayout>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
        });
        builder.Entity<Room>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Layout).WithMany(l => l.Rooms).HasForeignKey(x => x.LayoutId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<Table>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Room).WithMany(r => r.Tables).HasForeignKey(x => x.RoomId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<Employee>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Email).HasMaxLength(256).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Role).HasMaxLength(100).IsRequired();
            e.Property(x => x.Position).HasMaxLength(100);
            e.HasOne(x => x.Department).WithMany(d => d.Employees).HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Table).WithMany(t => t.Employees).HasForeignKey(x => x.TableId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
