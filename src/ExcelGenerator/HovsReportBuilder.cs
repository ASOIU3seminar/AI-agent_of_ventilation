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

            // Вкладка 1: Ведомость помещений, нормативных ссылок и формул расчета воздухообмена (ГОСТ 21.602 / СП 60.13330)
            var wsRooms = workbook.Worksheets.Add("Помещения и Площади");
            string[] roomHeaders = {
                "№ Помещения",
                "Наименование помещения",
                "Категория СП",
                "Площадь S, м²",
                "Высота H, м",
                "Объем V, м³",
                "Люди / Сан. приборы",
                "Нормативный документ (СП / ГОСТ)",
                "Методика расчета",
                "Формула расчета воздухообмена",
                "Приток Lпр, м³/ч",
                "Вытяжка Lвыт, м³/ч",
                "Дисбаланс ΔL, м³/ч",
                "Система",
                "Источник разметки"
            };

            for (int c = 0; c < roomHeaders.Length; c++)
            {
                var cell = wsRooms.Cell(1, c + 1);
                cell.Value = roomHeaders[c];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F766E");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            }

            int rIdx = 2;
            foreach (var room in rooms)
            {
                string occupantInfo = "—";
                if (room.ToiletCount > 0 || room.UrinalCount > 0 || room.ShowerCount > 0 || room.SinkCount > 0)
                {
                    var p = new List<string>();
                    if (room.ToiletCount > 0) p.Add($"{room.ToiletCount} унит.");
                    if (room.UrinalCount > 0) p.Add($"{room.UrinalCount} писс.");
                    if (room.ShowerCount > 0) p.Add($"{room.ShowerCount} душ.");
                    if (room.SinkCount > 0) p.Add($"{room.SinkCount} умыв.");
                    occupantInfo = string.Join(", ", p);
                }
                else if (room.PeopleCount > 0)
                {
                    occupantInfo = $"{room.PeopleCount} чел. {(room.HasNaturalVentilation ? "(окна)" : "")}";
                }

                wsRooms.Cell(rIdx, 1).Value = room.Number;
                wsRooms.Cell(rIdx, 2).Value = room.RawName;
                wsRooms.Cell(rIdx, 3).Value = room.NormalizedType;
                wsRooms.Cell(rIdx, 4).Value = room.Area;
                wsRooms.Cell(rIdx, 5).Value = room.Height;
                wsRooms.Cell(rIdx, 6).FormulaA1 = $"ROUND(D{rIdx}*E{rIdx}, 2)";
                wsRooms.Cell(rIdx, 7).Value = occupantInfo;
                wsRooms.Cell(rIdx, 8).Value = string.IsNullOrEmpty(room.NormCode) ? "СП 60.13330.2020" : room.NormCode;
                wsRooms.Cell(rIdx, 9).Value = string.IsNullOrEmpty(room.CalculationMethod) ? "По кратности" : room.CalculationMethod;
                wsRooms.Cell(rIdx, 10).Value = string.IsNullOrEmpty(room.CalculationFormula)
                    ? $"Lпр = {room.RequiredSupplyAir} м³/ч; Lвыт = {room.RequiredExhaustAir} м³/ч"
                    : room.CalculationFormula;
                wsRooms.Cell(rIdx, 11).Value = room.RequiredSupplyAir;
                wsRooms.Cell(rIdx, 12).Value = room.RequiredExhaustAir;
                wsRooms.Cell(rIdx, 13).FormulaA1 = $"K{rIdx}-L{rIdx}";
                wsRooms.Cell(rIdx, 14).Value = room.SystemTag;
                wsRooms.Cell(rIdx, 15).Value = room.DetectionSource;

                // Выравнивание чисел
                wsRooms.Cell(rIdx, 4).Style.NumberFormat.Format = "#,##0.00";
                wsRooms.Cell(rIdx, 5).Style.NumberFormat.Format = "#,##0.00";
                wsRooms.Cell(rIdx, 6).Style.NumberFormat.Format = "#,##0.00";
                wsRooms.Cell(rIdx, 11).Style.NumberFormat.Format = "#,##0";
                wsRooms.Cell(rIdx, 12).Style.NumberFormat.Format = "#,##0";
                wsRooms.Cell(rIdx, 13).Style.NumberFormat.Format = "#,##0";

                rIdx++;
            }

            if (rIdx > 2)
            {
                wsRooms.Cell(rIdx, 3).Value = "ИТОГО ПО ЭТАЖУ:";
                wsRooms.Cell(rIdx, 3).Style.Font.Bold = true;
                wsRooms.Cell(rIdx, 4).FormulaA1 = $"SUM(D2:D{rIdx - 1})";
                wsRooms.Cell(rIdx, 6).FormulaA1 = $"SUM(F2:F{rIdx - 1})";
                wsRooms.Cell(rIdx, 11).FormulaA1 = $"SUM(K2:K{rIdx - 1})";
                wsRooms.Cell(rIdx, 12).FormulaA1 = $"SUM(L2:L{rIdx - 1})";
                wsRooms.Cell(rIdx, 13).FormulaA1 = $"SUM(M2:M{rIdx - 1})";

                wsRooms.Cell(rIdx, 4).Style.NumberFormat.Format = "#,##0.00";
                wsRooms.Cell(rIdx, 6).Style.NumberFormat.Format = "#,##0.00";
                wsRooms.Cell(rIdx, 11).Style.NumberFormat.Format = "#,##0";
                wsRooms.Cell(rIdx, 12).Style.NumberFormat.Format = "#,##0";
                wsRooms.Cell(rIdx, 13).Style.NumberFormat.Format = "#,##0";

                wsRooms.Range($"A{rIdx}:O{rIdx}").Style.Font.Bold = true;
                wsRooms.Range($"A{rIdx}:O{rIdx}").Style.Fill.BackgroundColor = XLColor.FromHtml("#E6FFFA");
                wsRooms.Range($"A1:O{rIdx}").Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
                wsRooms.Range($"A1:O{rIdx}").Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
            }
            wsRooms.Columns().AdjustToContents();

            // Вкладка 2: ХОВС по ГОСТ 21.602
            var wsHovs = workbook.Worksheets.Add("ХОВС ГОСТ 21.602");
            string[] hovsHeaders = {
                "Обозначение системы",
                "Тип установки",
                "Обслуживаемые помещения (№ и наименование)",
                "Суммарная площадь зон, м²",
                "Расход воздуха L, м³/ч",
                "Нормативное обоснование (СП)"
            };

            for (int c = 0; c < hovsHeaders.Length; c++)
            {
                var cell = wsHovs.Cell(1, c + 1);
                cell.Value = hovsHeaders[c];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1D4ED8");
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }

            int sRow = 2;
            foreach (var sys in systems.OrderBy(s => s.Designation))
            {
                wsHovs.Cell(sRow, 1).Value = sys.Designation;
                wsHovs.Cell(sRow, 2).Value = sys.Type == SystemType.Supply ? "Приточная установка" : "Вытяжная установка";
                wsHovs.Cell(sRow, 3).Value = string.Join(", ", sys.ServedRooms.Select(r => $"№{r.Number} ({r.RawName})"));
                wsHovs.Cell(sRow, 4).Value = sys.ServedRooms.Sum(r => r.Area);
                wsHovs.Cell(sRow, 5).Value = sys.TotalAirFlow;
                wsHovs.Cell(sRow, 6).Value = "СП 60.13330.2020 / ГОСТ 21.602-2016";

                wsHovs.Cell(sRow, 4).Style.NumberFormat.Format = "#,##0.00";
                wsHovs.Cell(sRow, 5).Style.NumberFormat.Format = "#,##0";
                sRow++;
            }

            wsHovs.Range($"A1:F{Math.Max(2, sRow - 1)}").Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            wsHovs.Range($"A1:F{Math.Max(2, sRow - 1)}").Style.Border.SetInsideBorder(XLBorderStyleValues.Thin);
            wsHovs.Columns().AdjustToContents();

            workbook.SaveAs(outputPath);
        }
    }
}
