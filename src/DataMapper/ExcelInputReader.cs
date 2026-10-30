using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using ClosedXML.Excel;

namespace HvacAutoCalculator.DataMapper
{
    public class ExcelInputReader
    {
        public Dictionary<string, RoomAttributes> ReadAttributes(string filePath)
        {
            var attributes = new Dictionary<string, RoomAttributes>(StringComparer.OrdinalIgnoreCase);
            using var workbook = new XLWorkbook(filePath);

            foreach (var ws in workbook.Worksheets)
            {
                var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
                var lastCol = Math.Min(ws.LastColumnUsed()?.ColumnNumber() ?? 0, 15);

                for (int r = 1; r <= lastRow; r++)
                {
                    // Собираем непустые значения строки
                    var cells = new List<string>();
                    for (int c = 1; c <= lastCol; c++)
                    {
                        string val = ws.Cell(r, c).GetValue<string>().Trim();
                        if (!string.IsNullOrEmpty(val))
                            cells.Add(val);
                    }

                    if (cells.Count < 2) continue;

                    string firstCell = cells[0];
                    // Пропускаем шапки таблицы
                    if (firstCell.ToLowerInvariant().Contains("обозначение") ||
                        firstCell.ToLowerInvariant().Contains("номер") ||
                        firstCell.ToLowerInvariant().Contains("помещ") ||
                        firstCell.Length > 15)
                        continue;

                    string roomNumber = firstCell;
                    string rawType = cells.Count > 1 ? cells[1] : "Помещение";

                    double? areaOverride = null;
                    double? heightOverride = null;
                    int peopleCount = 0;

                    // Пытаемся вытащить численные параметры из остальных ячеек строки
                    for (int i = 2; i < cells.Count; i++)
                    {
                        string clean = cells[i].Replace(',', '.');
                        if (double.TryParse(clean, NumberStyles.Any, CultureInfo.InvariantCulture, out double num))
                        {
                            if (!areaOverride.HasValue && num >= 2.0 && num <= 2000.0)
                                areaOverride = num;
                            else if (!heightOverride.HasValue && num >= 2.2 && num <= 12.0)
                                heightOverride = num;
                            else if (peopleCount == 0 && num >= 1 && num <= 200 && Math.Abs(num % 1) < 0.001)
                                peopleCount = (int)num;
                        }
                    }

                    bool hasWindows = cells.Any(c => c.Equals("да", StringComparison.OrdinalIgnoreCase));

                    attributes[roomNumber] = new RoomAttributes
                    {
                        RoomNumber = roomNumber,
                        RawType = rawType,
                        AreaOverride = areaOverride,
                        HeightOverride = heightOverride,
                        PeopleCount = peopleCount,
                        HasNaturalVentilation = hasWindows
                    };
                }
            }

            return attributes;
        }
    }

    public class RoomAttributes
    {
        public string RoomNumber { get; set; } = string.Empty;
        public string RawType { get; set; } = string.Empty;
        public double? AreaOverride { get; set; }
        public double? HeightOverride { get; set; }
        public int PeopleCount { get; set; }
        public bool HasNaturalVentilation { get; set; }
    }
}
