using System;
using System.Collections.Generic;
using System.IO;
using ClosedXML.Excel;
using Xunit;
using HvacAutoCalculator.Domain.Models;
using HvacAutoCalculator.ExcelGenerator;

namespace HvacAutoCalculator.Tests
{
    public class HovsReportBuilderTests
    {
        [Fact]
        public void GenerateFullWorkbook_IncludesNormativeCitationAndFormulaColumns()
        {
            var builder = new HovsReportBuilder();
            var rooms = new List<Room>
            {
                new Room
                {
                    Number = "-5.01",
                    RawName = "Помещение хранения автомобилей на 130 м/м",
                    NormalizedType = "Автостоянка (В2)",
                    Area = 4765.33,
                    Height = 3.60,
                    NormCode = "СП 60.13330.2020 / СП 113.13330",
                    CalculationMethod = "Кратность (Kпр=4.0, Kвыт=5.0)",
                    CalculationFormula = "Lпр = 4.0 × 17155.19 = 68621 м³/ч; Lвыт = 5.0 × 17155.19 = 85776 м³/ч",
                    RequiredSupplyAir = 68621,
                    RequiredExhaustAir = 85776,
                    SystemTag = "П-Паркинг / В-Паркинг",
                    DetectionSource = "Экспликация PDF + План"
                },
                new Room
                {
                    Number = "-5.02",
                    RawName = "Санузел",
                    NormalizedType = "Санузел",
                    Area = 4.0,
                    Height = 3.30,
                    ToiletCount = 1,
                    UrinalCount = 1,
                    NormCode = "СП 118.13330.2022 табл. 7.1 / СП 44.13330",
                    CalculationMethod = "По сан. приборам (СП 118.13330)",
                    CalculationFormula = "Lвыт = 1 унит × 50 + 1 писс × 25 = 75 м³/ч; Lпр = 0 (переток по СП 118.13330)",
                    RequiredSupplyAir = 0,
                    RequiredExhaustAir = 75,
                    SystemTag = "В-СУ",
                    DetectionSource = "Экспликация PDF + План"
                }
            };

            var systems = new List<VentilationSystem>
            {
                new VentilationSystem
                {
                    Designation = "П-Паркинг",
                    Type = SystemType.Supply,
                    ServedRooms = rooms
                }
            };

            string tempPath = Path.Combine(Path.GetTempPath(), $"hovs_test_{Guid.NewGuid():N}.xlsx");

            try
            {
                builder.GenerateFullWorkbook(rooms, systems, tempPath);
                Assert.True(File.Exists(tempPath), "Excel файл должен успешно создаваться");

                using var wb = new XLWorkbook(tempPath);
                var ws = wb.Worksheet("Помещения и Площади");
                Assert.NotNull(ws);

                // Проверяем заголовки колонок
                Assert.Equal("Люди / Сан. приборы", ws.Cell("G1").GetString());
                Assert.Equal("Нормативный документ (СП / ГОСТ)", ws.Cell("H1").GetString());
                Assert.Equal("Методика расчета", ws.Cell("I1").GetString());
                Assert.Equal("Формула расчета воздухообмена", ws.Cell("J1").GetString());

                // Проверяем заполнение данных первой строки (автостоянка)
                Assert.Equal("-5.01", ws.Cell("A2").GetString());
                Assert.Equal("СП 60.13330.2020 / СП 113.13330", ws.Cell("H2").GetString());
                Assert.Contains("Lвыт = 5.0", ws.Cell("J2").GetString());

                // Проверяем заполнение данных второй строки (санузел)
                Assert.Equal("-5.02", ws.Cell("A3").GetString());
                Assert.Contains("1 унит.", ws.Cell("G3").GetString());
                Assert.Contains("1 писс.", ws.Cell("G3").GetString());
                Assert.Equal(75, ws.Cell("L3").GetDouble());

                // Проверяем наличие формулы в объеме V
                Assert.True(ws.Cell("F2").HasFormula, "Ячейка объема F2 должна содержать формулу Excel");
                Assert.Equal("ROUND(D2*E2, 2)", ws.Cell("F2").FormulaA1);

                // Проверяем итоговую строку (строка 4)
                Assert.Equal("ИТОГО ПО ЭТАЖУ:", ws.Cell("C4").GetString());
                Assert.True(ws.Cell("D4").HasFormula, "Сумма площадей должна быть формулой SUM");
                Assert.Equal("SUM(D2:D3)", ws.Cell("D4").FormulaA1);
                Assert.Equal("SUM(K2:K3)", ws.Cell("K4").FormulaA1);
                Assert.Equal("SUM(L2:L3)", ws.Cell("L4").FormulaA1);
            }
            finally
            {
                if (File.Exists(tempPath)) File.Delete(tempPath);
            }
        }
    }
}
