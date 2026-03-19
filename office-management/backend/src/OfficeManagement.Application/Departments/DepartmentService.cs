using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.Departments;

public class DepartmentService : IDepartmentService
{
    private readonly IApplicationDbContext _context;

    public DepartmentService(IApplicationDbContext context) => _context = context;

    public async Task<IEnumerable<DepartmentDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.Departments.OrderBy(d => d.Name).Select(d => new DepartmentDto(d.Id, d.Name, d.Description, d.Code, d.CreatedAt)).ToListAsync(cancellationToken);

    public async Task<DepartmentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Departments.FindAsync([id], cancellationToken);
        return entity is null ? null : new DepartmentDto(entity.Id, entity.Name, entity.Description, entity.Code, entity.CreatedAt);
    }

    public async Task<DepartmentDto> CreateAsync(CreateDepartmentRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Department { Name = request.Name, Description = request.Description, Code = request.Code };
        _context.Departments.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);
        return new DepartmentDto(entity.Id, entity.Name, entity.Description, entity.Code, entity.CreatedAt);
    }

    public async Task<DepartmentDto?> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Departments.FindAsync([id], cancellationToken);
        if (entity is null) return null;
        entity.Name = request.Name;
        entity.Description = request.Description;
        entity.Code = request.Code;
        entity.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return new DepartmentDto(entity.Id, entity.Name, entity.Description, entity.Code, entity.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Departments.FindAsync([id], cancellationToken);
        if (entity is null) return false;
        _context.Departments.Remove(entity);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
