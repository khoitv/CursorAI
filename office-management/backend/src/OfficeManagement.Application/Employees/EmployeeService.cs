using Microsoft.EntityFrameworkCore;
using OfficeManagement.Application.Common.Interfaces;
using OfficeManagement.Domain.Entities;

namespace OfficeManagement.Application.Employees;

public class EmployeeService : IEmployeeService
{
    private readonly IApplicationDbContext _context;

    public EmployeeService(IApplicationDbContext context) => _context = context;

    public async Task<IEnumerable<EmployeeDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await _context.Employees
            .Include(e => e.Department)
            .OrderBy(e => e.FullName)
            .Select(e => new EmployeeDto(e.Id, e.FullName, e.Email, e.Role, e.TableId, e.Department.Name, e.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<EmployeeDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Employees.Include(e => e.Department).FirstOrDefaultAsync(e => e.Id == id, cancellationToken);
        return entity is null ? null : new EmployeeDto(entity.Id, entity.FullName, entity.Email, entity.Role, entity.TableId, entity.Department.Name, entity.CreatedAt);
    }

    public async Task<IEnumerable<EmployeeDto>> GetByTableIdAsync(Guid tableId, CancellationToken cancellationToken = default) =>
        await _context.Employees
            .Include(e => e.Department)
            .Where(e => e.TableId == tableId)
            .OrderBy(e => e.FullName)
            .Select(e => new EmployeeDto(e.Id, e.FullName, e.Email, e.Role, e.TableId, e.Department.Name, e.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Employee { FullName = request.Name, Email = request.Email, Role = request.Role, DepartmentId = request.DepartmentId, TableId = request.TableId };
        _context.Employees.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);
        var dept = await _context.Departments.FindAsync([entity.DepartmentId], cancellationToken);
        return new EmployeeDto(entity.Id, entity.FullName, entity.Email, entity.Role, entity.TableId, dept?.Name ?? "", entity.CreatedAt);
    }

    public async Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Employees.FindAsync([id], cancellationToken);
        if (entity is null) return null;
        entity.FullName = request.Name;
        entity.Email = request.Email;
        entity.Role = request.Role;
        entity.DepartmentId = request.DepartmentId;
        entity.TableId = request.TableId;
        entity.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        var dept = await _context.Departments.FindAsync([entity.DepartmentId], cancellationToken);
        return new EmployeeDto(entity.Id, entity.FullName, entity.Email, entity.Role, entity.TableId, dept?.Name ?? "", entity.CreatedAt);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await _context.Employees.FindAsync([id], cancellationToken);
        if (entity is null) return false;
        _context.Employees.Remove(entity);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
