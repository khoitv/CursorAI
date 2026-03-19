using Microsoft.EntityFrameworkCore;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Infrastructure.Persistence;

public static class DataSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, CancellationToken cancellationToken = default)
    {
        if (await context.Departments.AnyAsync(cancellationToken))
            return;

        var now = DateTime.UtcNow;

        var devDept = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111101"), Name = "Phòng Công nghệ", Description = "Phát triển phần mềm", Code = "DEV", CreatedAt = now };
        var hrDept = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111102"), Name = "Nhân sự", Description = "Quản lý nhân sự", Code = "HR", CreatedAt = now };
        var adminDept = new Department { Id = Guid.Parse("11111111-1111-1111-1111-111111111103"), Name = "Hành chính", Description = "Hành chính văn phòng", Code = "ADMIN", CreatedAt = now };
        context.Departments.AddRange(devDept, hrDept, adminDept);
        await context.SaveChangesAsync(cancellationToken);

        var layout1 = new OfficeLayout { Id = Guid.Parse("22222222-2222-2222-2222-222222222201"), Name = "Tầng 1 - Open space", Description = "Khu vực làm việc mở tầng 1", CreatedAt = now };
        var layout2 = new OfficeLayout { Id = Guid.Parse("22222222-2222-2222-2222-222222222202"), Name = "Tầng 2 - Phòng họp", Description = "Các phòng họp tầng 2", CreatedAt = now };
        context.OfficeLayouts.AddRange(layout1, layout2);
        await context.SaveChangesAsync(cancellationToken);

        var room1 = new Room { Id = Guid.Parse("33333333-3333-3333-3333-333333333301"), LayoutId = layout1.Id, Name = "Khu A", Floor = 1, Capacity = 20, CreatedAt = now };
        var room2 = new Room { Id = Guid.Parse("33333333-3333-3333-3333-333333333302"), LayoutId = layout1.Id, Name = "Khu B", Floor = 1, Capacity = 15, CreatedAt = now };
        var room3 = new Room { Id = Guid.Parse("33333333-3333-3333-3333-333333333303"), LayoutId = layout2.Id, Name = "Phòng họp 1", Floor = 2, Capacity = 8, CreatedAt = now };
        context.Rooms.AddRange(room1, room2, room3);
        await context.SaveChangesAsync(cancellationToken);

        var table1 = new Table { Id = Guid.Parse("44444444-4444-4444-4444-444444444401"), RoomId = room1.Id, Name = "Bàn 1", Seats = 4, PositionX = 10, PositionY = 10, CreatedAt = now };
        var table2 = new Table { Id = Guid.Parse("44444444-4444-4444-4444-444444444402"), RoomId = room1.Id, Name = "Bàn 2", Seats = 4, PositionX = 50, PositionY = 10, CreatedAt = now };
        var table3 = new Table { Id = Guid.Parse("44444444-4444-4444-4444-444444444403"), RoomId = room2.Id, Name = "Bàn 3", Seats = 2, PositionX = 20, PositionY = 20, CreatedAt = now };
        context.Tables.AddRange(table1, table2, table3);
        await context.SaveChangesAsync(cancellationToken);

        var emp1 = new Employee { Id = Guid.Parse("55555555-5555-5555-5555-555555555501"), FullName = "Nguyễn Văn A", Email = "nva@company.com", Role = "Developer", DepartmentId = devDept.Id, TableId = table1.Id, CreatedAt = now };
        var emp2 = new Employee { Id = Guid.Parse("55555555-5555-5555-5555-555555555502"), FullName = "Trần Thị B", Email = "ttb@company.com", Role = "HR Manager", DepartmentId = hrDept.Id, TableId = table2.Id, CreatedAt = now };
        var emp3 = new Employee { Id = Guid.Parse("55555555-5555-5555-5555-555555555503"), FullName = "Lê Văn C", Email = "lvc@company.com", Role = "Admin", DepartmentId = adminDept.Id, TableId = null, CreatedAt = now };
        context.Employees.AddRange(emp1, emp2, emp3);
        await context.SaveChangesAsync(cancellationToken);
    }
}
