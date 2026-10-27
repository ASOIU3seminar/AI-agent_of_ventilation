using System;
using System.Collections.Generic;
using System.Linq;

namespace HvacAutoCalculator.Domain.Models
{
    public class VentilationSystem
    {
        public Guid SystemId { get; set; } = Guid.NewGuid();
        public string Designation { get; set; } = string.Empty; // П1, В1, ВЕ1
        public SystemType Type { get; set; } 
        
        public List<Room> ServedRooms { get; set; } = new();

        public double TotalAirFlow => Type == SystemType.Supply 
            ? ServedRooms.Sum(r => r.RequiredSupplyAir) 
            : ServedRooms.Sum(r => r.RequiredExhaustAir);
            
        public double PressureDrop { get; set; } // Для аэродинамического расчета
    }

    public enum SystemType { Supply, Exhaust, NaturalExhaust }
}