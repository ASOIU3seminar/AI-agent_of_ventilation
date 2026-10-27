using System.Collections.Generic;
using System.Linq;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.HVACCalculator
{
    public class BalanceResolver
    {
        public void ResolveBuildingBalance(List<Room> allRooms)
        {
            double totalSupply = allRooms.Sum(r => r.RequiredSupplyAir);
            double totalExhaust = allRooms.Sum(r => r.RequiredExhaustAir);

            double imbalance = totalExhaust - totalSupply;

            // Если дисбаланс положительный (вытяжки больше, типично из-за с/у)
            if (imbalance > 0)
            {
                var corridors = allRooms.Where(r => r.NormalizedType.Contains("Коридор") || r.NormalizedType.Contains("Холл")).ToList();
                if (corridors.Any())
                {
                    double addPerCorridor = imbalance / corridors.Count;
                    foreach (var corridor in corridors)
                    {
                        corridor.RequiredSupplyAir += addPerCorridor;
                    }
                }
            }
        }
    }
}