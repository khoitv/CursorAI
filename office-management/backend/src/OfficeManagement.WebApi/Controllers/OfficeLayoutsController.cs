using Microsoft.AspNetCore.Mvc;
using OfficeManagement.Application.OfficeLayouts;

namespace OfficeManagement.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class OfficeLayoutsController : ControllerBase
{
    private readonly IOfficeLayoutService _service;

    public OfficeLayoutsController(IOfficeLayoutService service) => _service = service;

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<OfficeLayoutDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<OfficeLayoutDto>>> GetAll(CancellationToken ct) =>
        Ok(await _service.GetAllAsync(ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OfficeLayoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OfficeLayoutDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [ProducesResponseType(typeof(OfficeLayoutDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<OfficeLayoutDto>> Create([FromBody] CreateOfficeLayoutRequest request, CancellationToken ct)
    {
        var dto = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(OfficeLayoutDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OfficeLayoutDto>> Update(Guid id, [FromBody] UpdateOfficeLayoutRequest request, CancellationToken ct)
    {
        var dto = await _service.UpdateAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
