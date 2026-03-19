using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.Rooms;

public class RoomService : IRoomService
{
    private readonly IApplicationDbContext _context;

    public RoomService(IApplicationDbContext context) => _context = context;

    public async Task<IEnumerable<RoomDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.Rooms.OrderBy(x => x.Name).Select(x => new RoomDto(x.Id, x.LayoutId, x.Name, x.Floor, x.Capacity, x.CreatedAt)).ToListAsync(cancellationToken);

    public async Task<IEnumerable<RoomDto>> GetByLayoutIdAsync(Guid layoutId, CancellationToken cancellationToken = default) =>
        await _context.Rooms.Where(x => x.LayoutId == layoutId).OrderBy(x => x.Name).Select(x => new RoomDto(x.Id, x.LayoutId, x.Name, x.Floor, x.Capacity, x.CreatedAt)).ToListAsync(cancellationToken);

    public async Task<RoomDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Rooms.FindAsync([id], cancellationToken);
        return e is null ? null : new RoomDto(e.Id, e.LayoutId, e.Name, e.Floor, e.Capacity, e.CreatedAt);
    }

    public async Task<RoomDto> CreateAsync(CreateRoomRequest request, CancellationToken cancellationToken = default)
    {
        var e = new Room { LayoutId = request.LayoutId, Name = request.Name, Floor = request.Floor, Capacity = request.Capacity };
        _context.Rooms.Add(e);
        await _context.SaveChangesAsync(cancellationToken);
        return new RoomDto(e.Id, e.LayoutId, e.Name, e.Floor, e.Capacity, e.CreatedAt);
    }

    public async Task<RoomDto?> UpdateAsync(Guid id, UpdateRoomRequest request, CancellationToken cancellationToken = default)
    {
        var e = await _context.Rooms.FindAsync([id], cancellationToken);
        if (e is null) return null;
        e.Name = request.Name;
        e.Floor = request.Floor;
        e.Capacity = request.Capacity;
        e.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return new RoomDto(e.Id, e.LayoutId, e.Name, e.Floor, e.Capacity, e.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Rooms.FindAsync([id], cancellationToken);
        if (e is null) return false;
        _context.Rooms.Remove(e);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
