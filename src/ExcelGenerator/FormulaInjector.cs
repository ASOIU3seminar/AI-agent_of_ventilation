using ClosedXML.Excel;

namespace HvacAutoCalculator.ExcelGenerator
{
    public class FormulaInjector
    {
        // Динамическое добавление строки "Итого" с формулой SUM для колонок расхода
        public void InjectTotalsFormula(IXLWorksheet ws, int startRow, int endRow, int columnToSum)
        {
            if (startRow > endRow) return;
            
            int totalRow = endRow + 1;
            
            // Подпись "ИТОГО"
            ws.Cell(totalRow, columnToSum - 1).Value = "ИТОГО:";
            ws.Cell(totalRow, columnToSum - 1).Style.Font.Bold = true;
            ws.Cell(totalRow, columnToSum - 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            
            // Внедрение формулы =SUM(C2:C10)
            string columnLetter = ws.Column(columnToSum).ColumnLetter();
            ws.Cell(totalRow, columnToSum).FormulaA1 = $"SUM({columnLetter}{startRow}:{columnLetter}{endRow})";
            ws.Cell(totalRow, columnToSum).Style.Font.Bold = true;
            ws.Cell(totalRow, columnToSum).Style.Border.SetTopBorder(XLBorderStyleValues.Double);
        }
    }
}