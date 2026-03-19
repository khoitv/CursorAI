namespace OfficeManagement.Domain.Entities;

public class Employee : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Role { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public Guid? TableId { get; set; }
    public string? Position { get; set; }
    public virtual Department Department { get; set; } = null!;
    public virtual Table? Table { get; set; }
}
