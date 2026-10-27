using Xunit;
using HvacAutoCalculator.Domain.Models;
using HvacAutoCalculator.HVACCalculator.Agents;

namespace HvacAutoCalculator.Tests
{
    public class AirExchangeTests
    {
        [Fact]
        public void CalculateFlow_OfficeWithWindows_CalculatesByPeople()
        {
            var agent = new CalculationAgent();
            var room = new Room 
            { 
                NormalizedType = "Офис", Area = 20, Height = 3, 
                PeopleCount = 5, HasNaturalVentilation = true 
            };
            
            agent.CalculateFlow(room);
            
            // 5 человек * 30 м3/ч = 150
            Assert.Equal(150, room.RequiredSupplyAir);
            Assert.Equal(150, room.RequiredExhaustAir);
        }

        [Fact]
        public void CalculateFlow_SanNuzel_CalculatesByFixedNorm()
        {
            var agent = new CalculationAgent();
            var room = new Room 
            { 
                NormalizedType = "Санузел", Area = 10, Height = 3, PeopleCount = 0 
            };
            
            agent.CalculateFlow(room);
            
            // По словарю агента: приток 0, вытяжка 50 (т.к. норма > 10, берется фикс)
            Assert.Equal(0, room.RequiredSupplyAir);
            Assert.Equal(50, room.RequiredExhaustAir);
        }
    }
}