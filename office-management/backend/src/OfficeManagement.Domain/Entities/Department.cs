namespace OfficeManagement.Domain.Entities;

public class Department : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Code { get; set; }
    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
