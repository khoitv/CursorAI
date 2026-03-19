namespace OfficeManagement.Application.OfficeLayouts;

public record OfficeLayoutDto(Guid Id, string Name, string Description, DateTime CreatedAt);

public record CreateOfficeLayoutRequest(string Name, string Description);

public record UpdateOfficeLayoutRequest(string Name, string Description);
