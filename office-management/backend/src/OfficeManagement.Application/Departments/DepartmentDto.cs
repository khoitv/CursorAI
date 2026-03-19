namespace OfficeManagement.Application.Departments;

public record DepartmentDto(Guid Id, string Name, string? Description, string? Code, DateTime CreatedAt);

public record CreateDepartmentRequest(string Name, string? Description, string? Code);

public record UpdateDepartmentRequest(string Name, string? Description, string? Code);
