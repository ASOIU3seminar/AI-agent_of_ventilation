using System;
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
            var allRooms = systems.SelectMany(s => s.ServedRooms).DistinctBy(r => r.RoomId).OrderBy(r => r.Number).ToList();
            GenerateFullWorkbook(allRooms, systems, outputPath);
        }

        public void GenerateFullWorkbook(List<Room> rooms, List<VentilationSystem> systems, string outputPath)
        {
            using var workbook = new XLWorkbook();

            // Вкладка 1: Ведомость помещений и площадей (ТВО)
            var wsRooms = workbook.Worksheets.Add("Помещения и Площади");
            string[] roomHeaders = {
                "№ Помещения", "Наименование", "Категория СП", "Площадь S, м²",
                "Высота H, м", "Объем V, м³", "Приток Lпр, м³/ч", "Вытяжка Lвыт, м³/ч", "Источник разметки"
            };

            for (int c = 0; c < roomHeaders.Length; c++)
            {
                var cell = wsRooms.Cell(1, c + 1);
                cell.Value = roomHeaders[c];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F766E");
                cell.Style.Font.FontColor = XLColor.White;
            }

            int rIdx = 2;
            foreach (var room in rooms)
            {
                wsRooms.Cell(rIdx, 1).Value = room.Number;
                wsRooms.Cell(rIdx, 2).Value = room.RawName;
                wsRooms.Cell(rIdx, 3).Value = room.NormalizedType;
                wsRooms.Cell(rIdx, 4).Value = room.Area;
                wsRooms.Cell(rIdx, 5).Value = room.Height;
                wsRooms.Cell(rIdx, 6).FormulaA1 = $"ROUND(D{rIdx}*E{rIdx}, 2)";
                wsRooms.Cell(rIdx, 7).Value = room.RequiredSupplyAir;
                wsRooms.Cell(rIdx, 8).Value = room.RequiredExhaustAir;
                wsRooms.Cell(rIdx, 9).Value = room.DetectionSource;
                rIdx++;
            }

            if (rIdx > 2)
            {
                wsRooms.Cell(rIdx, 3).Value = "ИТОГО:";
                wsRooms.Cell(rIdx, 3).Style.Font.Bold = true;
                wsRooms.Cell(rIdx, 4).FormulaA1 = $"SUM(D2:D{rIdx - 1})";
                wsRooms.Cell(rIdx, 6).FormulaA1 = $"SUM(F2:F{rIdx - 1})";
                wsRooms.Cell(rIdx, 7).FormulaA1 = $"SUM(G2:G{rIdx - 1})";
                wsRooms.Cell(rIdx, 8).FormulaA1 = $"SUM(H2:H{rIdx - 1})";
                wsRooms.Range($"A{rIdx}:I{rIdx}").Style.Font.Bold = true;
                wsRooms.Range($"A1:I{rIdx}").Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
                wsRooms.Range($"A1:I{rIdx}").Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
            }
            wsRooms.Columns().AdjustToContents();

            // Вкладка 2: ХОВС по ГОСТ 21.602
            var wsHovs = workbook.Worksheets.Add("ХОВС ГОСТ 21.602");
            wsHovs.Cell("A1").Value = "Обозначение системы";
            wsHovs.Cell("B1").Value = "Обслуживаемые помещения (№ и наименование)";
            wsHovs.Cell("C1").Value = "Суммарная площадь зон, м²";
            wsHovs.Cell("D1").Value = "Расход воздуха L, м³/ч";
            wsHovs.Cell("E1").Value = "Тип установки";

            var headerRange = wsHovs.Range("A1:E1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#1D4ED8");
            headerRange.Style.Font.FontColor = XLColor.White;

            int sRow = 2;
            foreach (var sys in systems.OrderBy(s => s.Designation))
            {
                wsHovs.Cell(sRow, 1).Value = sys.Designation;
                wsHovs.Cell(sRow, 2).Value = string.Join(", ", sys.ServedRooms.Select(r => $"№{r.Number} ({r.RawName}, {r.Area} м²)"));
                wsHovs.Cell(sRow, 3).Value = sys.ServedRooms.Sum(r => r.Area);
                wsHovs.Cell(sRow, 4).Value = sys.TotalAirFlow;
                wsHovs.Cell(sRow, 5).Value = sys.Type == SystemType.Supply ? "Приточная установка" : "Вытяжная установка";
                sRow++;
            }

            wsHovs.Range($"A1:E{Math.Max(2, sRow - 1)}").Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            wsHovs.Range($"A1:E{Math.Max(2, sRow - 1)}").Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
            wsHovs.Columns().AdjustToContents();

            workbook.SaveAs(outputPath);
        }
    }
}
