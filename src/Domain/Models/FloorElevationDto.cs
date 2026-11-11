using System;
using System.Collections.Generic;

namespace HvacAutoCalculator.Domain.Models
{
    public class FloorElevationDto
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "-3 этаж";
        public double ElevationBottom { get; set; } = -11.400; // H_i
        public double ElevationTop { get; set; } = -7.800;     // H_{i+1}
        public double SlabThickness { get; set; } = 0.300;     // \delta_i
        public double NetHeight => Math.Round(Math.Max(2.0, (ElevationTop - ElevationBottom) - SlabThickness), 2);
    }

    public class RoomCalculationDto
    {
        public Guid RoomId { get; set; }
        public string FloorId { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public double Area { get; set; }
        public double Height { get; set; }
        public double Volume => Math.Round(Area * Height, 2);
        public string NormCode { get; set; } = "СП 60.13330.2020";
        public string NormCitation { get; set; } = string.Empty;
        public double InflowRate { get; set; }
        public double ExhaustRate { get; set; }
        public double Balance => Math.Round(InflowRate - ExhaustRate, 0);
        public string SystemTag { get; set; } = "П1/В1";
    }

    public class HvacSystemGroupDto
    {
        public string SystemCode { get; set; } = string.Empty; // П1, В1, ВЕ-С/У
        public string SystemType { get; set; } = string.Empty; // Приточная / Вытяжная общеобменная / Вытяжная санузлов
        public string ServedRooms { get; set; } = string.Empty;
        public double BaseAirflow { get; set; }
        public double TotalAirflowWithReserve => Math.Round(BaseAirflow * 1.10, 0); // Запас 10% по п. 2.4 ТЗ
        public double MainDuctCrossSection => Math.Round(TotalAirflowWithReserve / (3600.0 * 4.5), 4); // v1 = 4.5 м/с
        public double BranchDuctCrossSection => Math.Round(TotalAirflowWithReserve / (3600.0 * 2.5), 4); // v2 = 2.5 м/с
        public double GalvanizedSteelArea => Math.Round(TotalAirflowWithReserve * 0.10, 1); // S_возд ≈ 0.10 * L_сист
        public string RecommendedMetalThickness { get; set; } = "0.5 мм / 0.7 мм";
        public string SelectedUnitModel { get; set; } = string.Empty;
    }

    public class EstimateLineItemDto
    {
        public int Position { get; set; }
        public string Section { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Specification { get; set; } = string.Empty;
        public string Unit { get; set; } = "шт.";
        public double Quantity { get; set; }
        public double UnitPrice { get; set; }
        public double TotalPrice => Math.Round(Quantity * UnitPrice, 2);
    }

    public class EstimateSummaryDto
    {
        public List<HvacSystemGroupDto> Systems { get; set; } = new();
        public List<EstimateLineItemDto> Items { get; set; } = new();
        public double EquipmentTotal { get; set; }
        public double MaterialsTotal { get; set; }
        public double InstallationTotal { get; set; } // 40% от оборудования и материалов
        public double CommissioningTotal { get; set; } // 12% от монтажа (ПНР и паспортизация)
        public double GrandTotal => Math.Round(EquipmentTotal + MaterialsTotal + InstallationTotal + CommissioningTotal, 2);
    }
}