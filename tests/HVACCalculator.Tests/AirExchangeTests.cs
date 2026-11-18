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
        public async Task ApplyNormsAsync_Restroom_CalculatesByToiletsAndUrinals()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Санузел мужской",
                Area = 10.55,
                Height = 2.9,
                ToiletCount = 2,
                UrinalCount = 3
            };

            await engine.ApplyNormsAsync(room);

            // 2 унитаза * 50 + 3 писсуара * 25 = 100 + 75 = 175 м3/ч (как в проекте инженера К32)
            Assert.Equal(0, room.RequiredSupplyAir);
            Assert.Equal(175, room.RequiredExhaustAir);
            Assert.Contains("СП 118.13330", room.NormCode);
            Assert.Contains("2 унит × 50 + 3 писс × 25", room.CalculationFormula);
            Assert.Equal("В-СУ", room.SystemTag);
        }

        [Fact]
        public async Task ApplyNormsAsync_Restroom_AutoDeterminesCombinedToiletAndUrinal()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Санузел",
                Area = 3.56,
                Height = 3.3
            };

            await engine.ApplyNormsAsync(room);

            // По умолчанию: 1 унитаз (50) + 1 писсуар (25) = 75 м3/ч (как в строке 18 экспликации инженера)
            Assert.Equal(0, room.RequiredSupplyAir);
            Assert.Equal(75, room.RequiredExhaustAir);
            Assert.Equal(1, room.ToiletCount);
            Assert.Equal(1, room.UrinalCount);
            Assert.Contains("СП 118.13330", room.NormCode);
        }

        [Fact]
        public async Task ApplyNormsAsync_Office_CalculatesStrictlyByPeople()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Кабинет инженера / Офис",
                Area = 24.0,
                Height = 3.3,
                HasNaturalVentilation = false
            };

            await engine.ApplyNormsAsync(room);

            // 24 м2 / 6 м2 = 4 человека. Без проветривания: 4 * 60 = 240 м3/ч приток и вытяжка
            Assert.Equal(4, room.PeopleCount);
            Assert.Equal(240, room.RequiredSupplyAir);
            Assert.Equal(240, room.RequiredExhaustAir);
            Assert.Contains("4 чел × 60", room.CalculationFormula);
            Assert.Contains("СП 60.13330", room.NormCode);
            Assert.Contains("СанПиН 1.2.3685-21", room.NormCode);
        }

        [Fact]
        public async Task ApplyNormsAsync_OfficeWithWindows_Uses40M3PerHour()
        {
            var engine = new HvacNormativeEngine(new HttpClient());
            var room = new Room
            {
                RawName = "Офис дирекции",
                Area = 18.0,
                Height = 3.3,
                PeopleCount = 3,
                HasNaturalVentilation = true
            };

            await engine.ApplyNormsAsync(room);

            // 3 человека * 40 м3/ч = 120 м3/ч
            Assert.Equal(120, room.RequiredSupplyAir);
            Assert.Equal(120, room.RequiredExhaustAir);
            Assert.Contains("3 чел × 40", room.CalculationFormula);
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
