using Microsoft.Extensions.DependencyInjection;
using OfficeManagement.Application.Departments;
using OfficeManagement.Application.Employees;
using OfficeManagement.Application.OfficeLayouts;
using OfficeManagement.Application.Rooms;
using OfficeManagement.Application.Tables;

namespace OfficeManagement.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<IOfficeLayoutService, OfficeLayoutService>();
        services.AddScoped<IRoomService, RoomService>();
        services.AddScoped<ITableService, TableService>();
        return services;
    }
}
