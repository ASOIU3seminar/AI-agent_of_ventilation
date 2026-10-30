using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Threading.Tasks;
using System.Linq;
using HvacAutoCalculator.CADExtractor;
using HvacAutoCalculator.DataMapper;
using HvacAutoCalculator.ExcelGenerator;

namespace HvacAutoCalculator.HVACCalculator.Controllers
{
    [ApiController]
    [Route("api/hvac")]
    public class HvacController : ControllerBase
    {
        private readonly DwgParser _dwgParser;
        private readonly ExcelInputReader _excelReader;
        private readonly RoomMergeService _mergeService;
        private readonly AirExchangeEngine _engine;
        private readonly HovsReportBuilder _reportBuilder;

        public HvacController(DwgParser dwgParser, ExcelInputReader excelReader, RoomMergeService mergeService, AirExchangeEngine engine, HovsReportBuilder reportBuilder)
        {
            _dwgParser = dwgParser;
            _excelReader = excelReader;
            _mergeService = mergeService;
            _engine = engine;
            _reportBuilder = reportBuilder;
        }

        [HttpPost("calculate")]
        public async Task<IActionResult> Calculate([FromForm] IFormFile cadFile, [FromForm] IFormFile excelFile)
        {
            if (cadFile == null || excelFile == null) return BadRequest("Необходимы оба файла.");

            // Временное сохранение файлов
            var tempDwg = Path.GetTempFileName() + ".dwg";
            var tempExcel = Path.GetTempFileName() + ".xlsx";
            var outputExcel = Path.GetTempFileName() + "_ХОВС.xlsx";

            using (var stream = new FileStream(tempDwg, FileMode.Create)) await cadFile.CopyToAsync(stream);
            using (var stream = new FileStream(tempExcel, FileMode.Create)) await excelFile.CopyToAsync(stream);

            try
            {
                // Пайплайн обработки
                var cadRooms = await _dwgParser.ExtractGeometryAsync(tempDwg);
                var attributes = _excelReader.ReadAttributes(tempExcel);
                var mergedRooms = await _mergeService.MergeAsync(cadRooms, attributes);
                
                var systems = _engine.ProcessAndGroupSystems(mergedRooms);
                _reportBuilder.GenerateGostReport(systems, outputExcel);

                var bytes = await System.IO.File.ReadAllBytesAsync(outputExcel);
                return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "ХОВС_ГОСТ_21.602.xlsx");
            }
            finally
            {
                // Очистка временных файлов
                if (System.IO.File.Exists(tempDwg)) System.IO.File.Delete(tempDwg);
                if (System.IO.File.Exists(tempExcel)) System.IO.File.Delete(tempExcel);
                if (System.IO.File.Exists(outputExcel)) System.IO.File.Delete(outputExcel);
            }
        }
    }
}