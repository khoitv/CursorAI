namespace OfficeManagement.Domain.Entities;

public class Table : BaseEntity
{
    public Guid RoomId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Seats { get; set; }
    public double PositionX { get; set; }
    public double PositionY { get; set; }
    public virtual Room Room { get; set; } = null!;
    public virtual ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
