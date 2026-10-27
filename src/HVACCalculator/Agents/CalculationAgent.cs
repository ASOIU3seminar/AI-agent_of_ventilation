using System;
using System.Collections.Generic;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.HVACCalculator.Agents
{
    public class CalculationAgent
    {
        // Нормы кратностей [Приток, Вытяжка]
        private readonly Dictionary<string, (double Supply, double Exhaust)> _multiplicityNorms = new(StringComparer.OrdinalIgnoreCase)
        {
            { "Санузел", (0.0, 50.0) }, // 50 м3/ч на унитаз (упрощенно берем кубы на м2 в реальной базе)
            { "Душевая", (0.0, 75.0) },
            { "Кухня", (0.0, 3.0) }, // 3 крат вытяжка
            { "Склад", (1.0, 1.0) },
            { "Коридор", (0.0, 0.5) }
        };

        public void CalculateFlow(Room room)
        {
            double supplyFlow = 0;
            double exhaustFlow = 0;

            // 1. Расчет по людям (для офисов, кабинетов)
            if (room.PeopleCount > 0)
            {
                double normPerPerson = room.HasNaturalVentilation ? 30.0 : 60.0;
                supplyFlow = room.PeopleCount * normPerPerson;
                exhaustFlow = supplyFlow; // По умолчанию баланс в помещении
            }

            // 2. Расчет по кратностям (приоритет для тех. помещений)
            if (_multiplicityNorms.TryGetValue(room.NormalizedType, out var norms))
            {
                // Если норма < 10, считаем это кратностью (умножаем на объем). Иначе - фиксированный расход.
                double calculatedSupply = norms.Supply < 10 ? norms.Supply * room.Volume : norms.Supply;
                double calculatedExhaust = norms.Exhaust < 10 ? norms.Exhaust * room.Volume : norms.Exhaust;

                supplyFlow = Math.Max(supplyFlow, calculatedSupply);
                exhaustFlow = Math.Max(exhaustFlow, calculatedExhaust);
            }
            
            // Если помещение не распознано, минимальный санитарный воздухообмен 1 крат
            if (supplyFlow == 0 && exhaustFlow == 0)
            {
                supplyFlow = room.Volume * 1.0;
                exhaustFlow = room.Volume * 1.0;
            }

            room.RequiredSupplyAir = Math.Round(supplyFlow, 2);
            room.RequiredExhaustAir = Math.Round(exhaustFlow, 2);
        }
    }
}