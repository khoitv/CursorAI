namespace OfficeManagement.Application.Tables;

public record TableDto(Guid Id, Guid RoomId, string Name, int Seats, double PositionX, double PositionY, DateTime CreatedAt);

public record CreateTableRequest(Guid RoomId, string Name, int Seats, double PositionX, double PositionY);

public record UpdateTableRequest(string Name, int Seats, double PositionX, double PositionY);
