using System;

namespace HvacAutoCalculator.Domain.Models
{
    public class Room
    {
        public Guid RoomId { get; set; } = Guid.NewGuid();
        public string CadId { get; set; } = string.Empty; // ID контура в DWG/IFC
        public string Number { get; set; } = string.Empty;
        public string RawName { get; set; } = string.Empty; // Исходное имя из чертежа/таблицы
        public string NormalizedType { get; set; } = string.Empty; // Тип по СП 60.13330 (после LLM)
        
        // Геометрия
        public double Area { get; set; }
        public double Height { get; set; }
        public double Volume => Area * Height;

        // Технология
        public int PeopleCount { get; set; }
        public bool HasNaturalVentilation { get; set; }
        
        // Расчетные результаты
        public double RequiredSupplyAir { get; set; }
        public double RequiredExhaustAir { get; set; }
        
        // Привязка к системе графа
        public Guid? SupplySystemId { get; set; }
        public Guid? ExhaustSystemId { get; set; }
    }
}