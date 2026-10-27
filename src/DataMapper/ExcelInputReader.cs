using System.Collections.Generic;
using System.IO;
using ClosedXML.Excel;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.DataMapper
{
    public class ExcelInputReader
    {
        public Dictionary<string, RoomAttributes> ReadAttributes(string filePath)
        {
            var attributes = new Dictionary<string, RoomAttributes>();
            using var workbook = new XLWorkbook(filePath);
            var ws = workbook.Worksheet(1); // Первая вкладка
            
            int row = 2; // Пропуск шапки
            while (!ws.Cell(row, 1).IsEmpty())
            {
                string roomNumber = ws.Cell(row, 1).GetString().Trim();
                attributes[roomNumber] = new RoomAttributes
                {
                    RawType = ws.Cell(row, 2).GetString().Trim(),
                    HeightOverride = ws.Cell(row, 3).TryGetValue<double>(out var h) ? h : null,
                    PeopleCount = ws.Cell(row, 4).TryGetValue<int>(out var p) ? p : 0,
                    HasNaturalVentilation = ws.Cell(row, 5).GetString().ToLower() == "да"
                };
                row++;
            }
            return attributes;
        }
    }

    public class RoomAttributes
    {
        public string RawType { get; set; } = string.Empty;
        public double? HeightOverride { get; set; }
        public int PeopleCount { get; set; }
        public bool HasNaturalVentilation { get; set; }
    }
}