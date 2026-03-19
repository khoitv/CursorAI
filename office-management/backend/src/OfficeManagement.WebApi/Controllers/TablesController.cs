using Microsoft.AspNetCore.Mvc;
using OfficeManagement.Application.Tables;

namespace OfficeManagement.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TablesController : ControllerBase
{
    private readonly ITableService _service;

    public TablesController(ITableService service) => _service = service;

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<TableDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<TableDto>>> GetAll([FromQuery] Guid? roomId, CancellationToken ct)
    {
        var list = roomId.HasValue ? await _service.GetByRoomIdAsync(roomId.Value, ct) : await _service.GetAllAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TableDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TableDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<TableDto>> Create([FromBody] CreateTableRequest request, CancellationToken ct)
    {
        var dto = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TableDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TableDto>> Update(Guid id, [FromBody] UpdateTableRequest request, CancellationToken ct)
    {
        var dto = await _service.UpdateAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
