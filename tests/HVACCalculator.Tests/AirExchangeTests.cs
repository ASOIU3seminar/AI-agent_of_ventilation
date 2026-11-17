using System.Net.Http;
using System.Threading.Tasks;
using Xunit;
using HvacAutoCalculator.Domain.Models;
using HvacAutoCalculator.DataMapper;
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

        [Fact]
        public async Task ApplyNormsAsync_Parking_SetsSpCitationAndDetailedFormula()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Помещение хранения автомобилей на 130 м/м",
                FireCategory = "В2",
                Area = 1000.0,
                Height = 3.6
            };

            await engine.ApplyNormsAsync(room);

            // Объем = 1000 * 3.6 = 3600 м3
            // Приток = 3600 * 4 = 14400 м3/ч, Вытяжка = 3600 * 5 = 18000 м3/ч
            Assert.Contains("СП 60.13330", room.NormCode);
            Assert.Contains("СП 113.13330", room.NormCode);
            Assert.Equal(14400, room.RequiredSupplyAir);
            Assert.Equal(18000, room.RequiredExhaustAir);
            Assert.Contains("Lпр = 4.0", room.CalculationFormula);
            Assert.Contains("Lвыт = 5.0", room.CalculationFormula);
            Assert.True(room.Balance < 0, "В автостоянке должен быть отрицательный баланс (разрежение)");
        }

        [Fact]
        public async Task ApplyNormsAsync_Pui_SetsMin100AndSp118()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Комната уборочного инвентаря (ПУИ)",
                FireCategory = "В4",
                Area = 4.0,
                Height = 3.0
            };

            await engine.ApplyNormsAsync(room);

            // Объем = 12 м3, 5 * 12 = 60 < 100 => вытяжка 100 м3/ч
            Assert.Contains("СП 118.13330", room.NormCode);
            Assert.Equal(0, room.RequiredSupplyAir);
            Assert.Equal(100, room.RequiredExhaustAir);
            Assert.Contains("max(100", room.CalculationFormula);
        }

        [Fact]
        public async Task ApplyNormsAsync_VentChamber_CalculatesBalancedFlow()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Венткамера приточных систем",
                FireCategory = "Д",
                Area = 50.0,
                Height = 3.6
            };

            await engine.ApplyNormsAsync(room);

            // Объем = 180 м3, K=1.0
            Assert.Contains("СП 60.13330", room.NormCode);
            Assert.Equal(180, room.RequiredSupplyAir);
            Assert.Equal(180, room.RequiredExhaustAir);
            Assert.Contains("K=1.0", room.CalculationMethod);
        }
    }
}
