namespace OfficeManagement.Domain.Entities;

public class Room : BaseEntity
{
    public Guid LayoutId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Floor { get; set; }
    public int Capacity { get; set; }
    public virtual OfficeLayout Layout { get; set; } = null!;
    public virtual ICollection<Table> Tables { get; set; } = new List<Table>();
}
