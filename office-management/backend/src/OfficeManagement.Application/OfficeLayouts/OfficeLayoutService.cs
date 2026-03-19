using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.OfficeLayouts;

public class OfficeLayoutService : IOfficeLayoutService
{
    private readonly IApplicationDbContext _context;

    public OfficeLayoutService(IApplicationDbContext context) => _context = context;

    public async Task<IEnumerable<OfficeLayoutDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.OfficeLayouts
            .OrderBy(x => x.Name)
            .Select(x => new OfficeLayoutDto(x.Id, x.Name, x.Description, x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<OfficeLayoutDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.OfficeLayouts.FindAsync([id], cancellationToken);
        return e is null ? null : new OfficeLayoutDto(e.Id, e.Name, e.Description, e.CreatedAt);
    }

    public async Task<OfficeLayoutDto> CreateAsync(CreateOfficeLayoutRequest request, CancellationToken cancellationToken = default)
    {
        var e = new OfficeLayout { Name = request.Name, Description = request.Description };
        _context.OfficeLayouts.Add(e);
        await _context.SaveChangesAsync(cancellationToken);
        return new OfficeLayoutDto(e.Id, e.Name, e.Description, e.CreatedAt);
    }

    public async Task<OfficeLayoutDto?> UpdateAsync(Guid id, UpdateOfficeLayoutRequest request, CancellationToken cancellationToken = default)
    {
        var e = await _context.OfficeLayouts.FindAsync([id], cancellationToken);
        if (e is null) return null;
        e.Name = request.Name;
        e.Description = request.Description;
        e.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return new OfficeLayoutDto(e.Id, e.Name, e.Description, e.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.OfficeLayouts.FindAsync([id], cancellationToken);
        if (e is null) return false;
        _context.OfficeLayouts.Remove(e);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
