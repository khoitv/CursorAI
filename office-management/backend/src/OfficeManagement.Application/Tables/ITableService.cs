namespace OfficeManagement.Application.Tables;

public interface ITableService
{
    Task<IEnumerable<TableDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<TableDto>> GetByRoomIdAsync(Guid roomId, CancellationToken cancellationToken = default);
    Task<TableDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<TableDto> CreateAsync(CreateTableRequest request, CancellationToken cancellationToken = default);
    Task<TableDto?> UpdateAsync(Guid id, UpdateTableRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
