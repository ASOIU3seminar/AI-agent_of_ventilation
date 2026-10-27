using System.Collections.Generic;
using System.Linq;
using ClosedXML.Excel;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.ExcelGenerator
{
    public class HovsReportBuilder
    {
        public void GenerateGostReport(List<VentilationSystem> systems, string outputPath)
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("ХОВС");

            // Шапка по ГОСТ 21.602
            ws.Cell("A1").Value = "Обозначение системы";
            ws.Cell("B1").Value = "Наименование обслуживаемого помещения";
            ws.Cell("C1").Value = "Расход воздуха, L, м3/ч";
            ws.Cell("D1").Value = "Тип оборудования";
            var headerRange = ws.Range("A1:D1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            headerRange.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);

            int row = 2;
            foreach (var sys in systems.OrderBy(s => s.Designation))
            {
                ws.Cell(row, 1).Value = sys.Designation;
                
                // Группируем имена помещений
                string roomsStr = string.Join(", ", sys.ServedRooms.Select(r => r.Number + " " + r.NormalizedType));
                ws.Cell(row, 2).Value = roomsStr;
                
                ws.Cell(row, 3).Value = sys.TotalAirFlow;
                ws.Cell(row, 4).Value = sys.Type == SystemType.Supply ? "Приточная установка" : "Вентилятор вытяжной";
                
                var dataRange = ws.Range($"A{row}:D{row}");
                dataRange.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
                dataRange.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
                row++;
            }

            ws.Columns().AdjustToContents();
            workbook.SaveAs(outputPath);
        }
    }
}