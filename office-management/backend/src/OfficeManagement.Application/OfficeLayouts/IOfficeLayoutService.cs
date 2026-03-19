namespace OfficeManagement.Application.OfficeLayouts;

public interface IOfficeLayoutService
{
    Task<IEnumerable<OfficeLayoutDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<OfficeLayoutDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OfficeLayoutDto> CreateAsync(CreateOfficeLayoutRequest request, CancellationToken cancellationToken = default);
    Task<OfficeLayoutDto?> UpdateAsync(Guid id, UpdateOfficeLayoutRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
