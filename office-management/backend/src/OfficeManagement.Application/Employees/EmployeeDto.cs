namespace OfficeManagement.Application.Employees;

public record EmployeeDto(Guid Id, string Name, string Email, string Role, Guid? TableId, string Department, DateTime CreatedAt);

public record CreateEmployeeRequest(string Name, string Email, string Role, Guid DepartmentId, Guid? TableId);

public record UpdateEmployeeRequest(string Name, string Email, string Role, Guid DepartmentId, Guid? TableId);
