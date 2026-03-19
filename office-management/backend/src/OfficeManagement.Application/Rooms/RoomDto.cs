namespace OfficeManagement.Application.Rooms;

public record RoomDto(Guid Id, Guid LayoutId, string Name, int Floor, int Capacity, DateTime CreatedAt);

public record CreateRoomRequest(Guid LayoutId, string Name, int Floor, int Capacity);

public record UpdateRoomRequest(string Name, int Floor, int Capacity);
