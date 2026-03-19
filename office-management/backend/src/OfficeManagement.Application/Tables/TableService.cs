using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.Tables;

public class TableService : ITableService
{
    private readonly IApplicationDbContext _context;

    public TableService(IApplicationDbContext context) => _context = context;

    public async Task<IEnumerable<TableDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.Tables.OrderBy(x => x.Name).Select(x => new TableDto(x.Id, x.RoomId, x.Name, x.Seats, x.PositionX, x.PositionY, x.CreatedAt)).ToListAsync(cancellationToken);

    public async Task<IEnumerable<TableDto>> GetByRoomIdAsync(Guid roomId, CancellationToken cancellationToken = default) =>
        await _context.Tables.Where(x => x.RoomId == roomId).OrderBy(x => x.Name).Select(x => new TableDto(x.Id, x.RoomId, x.Name, x.Seats, x.PositionX, x.PositionY, x.CreatedAt)).ToListAsync(cancellationToken);

    public async Task<TableDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Tables.FindAsync([id], cancellationToken);
        return e is null ? null : new TableDto(e.Id, e.RoomId, e.Name, e.Seats, e.PositionX, e.PositionY, e.CreatedAt);
    }

    public async Task<TableDto> CreateAsync(CreateTableRequest request, CancellationToken cancellationToken = default)
    {
        var e = new Table { RoomId = request.RoomId, Name = request.Name, Seats = request.Seats, PositionX = request.PositionX, PositionY = request.PositionY };
        _context.Tables.Add(e);
        await _context.SaveChangesAsync(cancellationToken);
        return new TableDto(e.Id, e.RoomId, e.Name, e.Seats, e.PositionX, e.PositionY, e.CreatedAt);
    }

    public async Task<TableDto?> UpdateAsync(Guid id, UpdateTableRequest request, CancellationToken cancellationToken = default)
    {
        var e = await _context.Tables.FindAsync([id], cancellationToken);
        if (e is null) return null;
        e.Name = request.Name;
        e.Seats = request.Seats;
        e.PositionX = request.PositionX;
        e.PositionY = request.PositionY;
        e.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return new TableDto(e.Id, e.RoomId, e.Name, e.Seats, e.PositionX, e.PositionY, e.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Tables.FindAsync([id], cancellationToken);
        if (e is null) return false;
        _context.Tables.Remove(e);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
