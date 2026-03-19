using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using OfficeManagement.Application.Employees;
using OfficeManagement.WebApi.Hubs;

namespace OfficeManagement.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _service;
    private readonly IHubContext<NotificationsHub> _hubContext;

    public EmployeesController(IEmployeeService service, IHubContext<NotificationsHub> hubContext)
    {
        _service = service;
        _hubContext = hubContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<EmployeeDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<EmployeeDto>>> GetAll([FromQuery] Guid? tableId, CancellationToken ct)
    {
        var list = tableId.HasValue ? await _service.GetByTableIdAsync(tableId.Value, ct) : await _service.GetAllAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeDto>> GetById(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetByIdAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<EmployeeDto>> Create([FromBody] CreateEmployeeRequest request, CancellationToken ct)
    {
        var dto = await _service.CreateAsync(request, ct);
        if (dto.TableId is not null)
        {
            await _hubContext.Clients.All.SendAsync("EmployeeAssignedToTable", new
            {
                dto.Id,
                dto.Name,
                dto.TableId,
            }, ct);
        }

        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(EmployeeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeDto>> Update(Guid id, [FromBody] UpdateEmployeeRequest request, CancellationToken ct)
    {
        var dto = await _service.UpdateAsync(id, request, ct);
        if (dto is null) return NotFound();

        if (dto.TableId is not null)
        {
            await _hubContext.Clients.All.SendAsync("EmployeeAssignedToTable", new
            {
                dto.Id,
                dto.Name,
                dto.TableId,
            }, ct);
        }

        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
