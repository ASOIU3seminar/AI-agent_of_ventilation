using System;
using System.Collections.Generic;
using System.Linq;
using HvacAutoCalculator.Domain.Models;
using HvacAutoCalculator.HVACCalculator.Agents;

namespace HvacAutoCalculator.HVACCalculator
{
    public class AirExchangeEngine
    {
        private readonly CalculationAgent _calcAgent;
        private readonly BalanceResolver _balanceResolver;

        public AirExchangeEngine(CalculationAgent calcAgent, BalanceResolver balanceResolver)
        {
            _calcAgent = calcAgent;
            _balanceResolver = balanceResolver;
        }

        public List<VentilationSystem> ProcessAndGroupSystems(List<Room> rooms)
        {
            // 1. Расчет базовых расходов для каждого помещения
            foreach (var room in rooms)
            {
                _calcAgent.CalculateFlow(room);
            }

            // 2. Сведение баланса здания (компенсация вытяжек перетоками)
            _balanceResolver.ResolveBuildingBalance(rooms);

            // 3. Автоматическая группировка в системы
            var systems = new List<VentilationSystem>();
            
            var mainSupply = new VentilationSystem { Designation = "П1", Type = SystemType.Supply };
            var mainExhaust = new VentilationSystem { Designation = "В1", Type = SystemType.Exhaust };

            foreach (var room in rooms)
            {
                if (room.RequiredSupplyAir > 0)
                {
                    mainSupply.ServedRooms.Add(room);
                    room.SupplySystemId = mainSupply.SystemId;
                }
                
                if (room.RequiredExhaustAir > 0)
                {
                    mainExhaust.ServedRooms.Add(room);
                    room.ExhaustSystemId = mainExhaust.SystemId;
                }
            }

            if (mainSupply.ServedRooms.Any()) systems.Add(mainSupply);
            if (mainExhaust.ServedRooms.Any()) systems.Add(mainExhaust);

            return systems;
        }
    }
}