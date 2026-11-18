using System;

namespace HvacAutoCalculator.Domain.Models
{
    public class Room
    {
        public Guid RoomId { get; set; } = Guid.NewGuid();
        public string CadId { get; set; } = string.Empty;
        public string FloorId { get; set; } = "floor-1";
        public string Number { get; set; } = string.Empty;
        public string RawName { get; set; } = string.Empty;
        public string NormalizedType { get; set; } = string.Empty;
        public string FireCategory { get; set; } = "-";
        public double Area { get; set; }
        public double Height { get; set; } = 3.3;
        public double? CeilingHeightOverride { get; set; }
        public double EffectiveHeight => CeilingHeightOverride.HasValue && CeilingHeightOverride.Value > 0 && CeilingHeightOverride.Value <= Height
            ? CeilingHeightOverride.Value
            : Height;
        public double Volume => Math.Round(Area * EffectiveHeight, 2);

        // Расчет по людям (Офисы, кабинеты, переговорные)
        public int PeopleCount { get; set; }
        public int PeopleTempCount { get; set; }
        public bool HasNaturalVentilation { get; set; }

        // Расчет по сан. приборам (Санузлы, душевые, уборные)
        public int ToiletCount { get; set; }
        public int UrinalCount { get; set; }
        public int ShowerCount { get; set; }
        public int SinkCount { get; set; }

        public string NormCode { get; set; } = "СП 60.13330.2020";
        public string NormCitation { get; set; } = "Кратность по справочнику";
        public string CalculationMethod { get; set; } = "По кратности";
        public string CalculationFormula { get; set; } = string.Empty;
        public string SystemTag { get; set; } = "П1/В1";
        public Guid? SupplySystemId { get; set; }
        public Guid? ExhaustSystemId { get; set; }

        public double RequiredSupplyAir { get; set; }
        public double RequiredExhaustAir { get; set; }
        public double Balance => Math.Round(RequiredSupplyAir - RequiredExhaustAir, 0);

        public double CadX { get; set; }
        public double CadY { get; set; }
        public double BoxX { get; set; }
        public double BoxY { get; set; }
        public double BoxWidth { get; set; } = 8.0;
        public double BoxHeight { get; set; } = 6.5;
        public string DetectionSource { get; set; } = "Экспликация PDF";
    }
}
