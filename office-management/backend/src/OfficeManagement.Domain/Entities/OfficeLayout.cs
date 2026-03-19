namespace OfficeManagement.Domain.Entities;

public class OfficeLayout : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public virtual ICollection<Room> Rooms { get; set; } = new List<Room>();
}
