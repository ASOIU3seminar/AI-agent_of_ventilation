using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using HvacAutoCalculator.CADExtractor;

namespace HvacAutoCalculator.Tests
{
    public class PdfFloorPlanParserTests
    {
        [Fact]
        public async Task ExtractGeometryAsync_ExtractsRoomsAndHeightFromRealPdf()
        {
            string pdfPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "data", "input_templates", "K32_Лист_2_План_5_этажа_на_отметке_18,600_Layout1.pdf");
            if (!File.Exists(pdfPath))
            {
                // Fallback path
                pdfPath = "/home/roman/AI-agent_of_ventilation/data/input_templates/K32_Лист_2_План_5_этажа_на_отметке_18,600_Layout1.pdf";
            }

            Assert.True(File.Exists(pdfPath), $"Тестовый PDF файл должен существовать: {pdfPath}");

            var parser = new PdfFloorPlanParser();
            var rooms = (await parser.ExtractGeometryAsync(pdfPath)).ToList();

            // Проверяем, что извлечены реальные помещения, а не демо-версия (их не менее 20 шт.)
            Assert.NotEmpty(rooms);
            Assert.True(rooms.Count >= 20, $"Ожидалось >= 20 комнат, извлечено: {rooms.Count}");

            // Проверяем главное помещение автостоянки -5.01
            var parking = rooms.FirstOrDefault(r => r.Number == "-5.01");
            Assert.NotNull(parking);
            Assert.Contains("автомобил", parking.RawName.ToLowerInvariant());
            Assert.True(parking.Area > 4000, "Площадь стоянки должна быть > 4000 м2");
            Assert.Equal(3.6, parking.Height); // Высота 3.6 м определена из чертежа
        }
    }
}
