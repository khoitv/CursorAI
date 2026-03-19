namespace OfficeManagement.Application.Departments;

public interface IDepartmentService
{
    Task<IEnumerable<DepartmentDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<DepartmentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DepartmentDto> CreateAsync(CreateDepartmentRequest request, CancellationToken cancellationToken = default);
    Task<DepartmentDto?> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
