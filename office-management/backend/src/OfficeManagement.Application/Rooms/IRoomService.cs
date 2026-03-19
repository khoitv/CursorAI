namespace OfficeManagement.Application.Rooms;

public interface IRoomService
{
    Task<IEnumerable<RoomDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<RoomDto>> GetByLayoutIdAsync(Guid layoutId, CancellationToken cancellationToken = default);
    Task<RoomDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<RoomDto> CreateAsync(CreateRoomRequest request, CancellationToken cancellationToken = default);
    Task<RoomDto?> UpdateAsync(Guid id, UpdateRoomRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
