using System;

namespace HvacAutoCalculator.Domain.Models
{
    public class Room
    {
        public Guid RoomId { get; set; } = Guid.NewGuid();
        public string CadId { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string RawName { get; set; } = string.Empty;
        public string NormalizedType { get; set; } = string.Empty;

        // Геометрия помещения
        public double Area { get; set; }
        public double Height { get; set; } = 3.0;
        public double Volume => Math.Round(Area * Height, 2);

        // Координаты разграниченной зоны на плане этажа (в % от 0 до 100 для отрисовки на фронте)
        public double BoxX { get; set; }
        public double BoxY { get; set; }
        public double BoxWidth { get; set; }
        public double BoxHeight { get; set; }
        public string DetectionSource { get; set; } = "PDF AI-Segmenter";

        // Технология и воздухообмен
        public int PeopleCount { get; set; }
        public bool HasNaturalVentilation { get; set; }
        public double RequiredSupplyAir { get; set; }
        public double RequiredExhaustAir { get; set; }

        public Guid? SupplySystemId { get; set; }
        public Guid? ExhaustSystemId { get; set; }
    }
}
