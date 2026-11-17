using Xunit;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.Tests
{
    public class FloorElevationTests
    {
        [Fact]
        public void NetHeight_CalculatedDirectlyFromElevationDelta_WithoutSlabThickness()
        {
            // Этаж -5 отметка -18.600, этаж -4 отметка -15.000
            var floor = new FloorElevationDto
            {
                Name = "-5 этаж",
                ElevationBottom = -18.600,
                ElevationTop = -15.000,
                HeightOverride = null
            };

            // Чистая высота должна быть ровно разность отметок: 3.6 м, без вычета плиты!
            Assert.Equal(3.600, floor.NetHeight);
        }

        [Fact]
        public void NetHeight_WithExplicitHeightOverride_UsesOverrideDirectly()
        {
            var floor = new FloorElevationDto
            {
                Name = "Типовой этаж",
                ElevationBottom = 0.000,
                ElevationTop = 3.600,
                HeightOverride = 3.300
            };

            Assert.Equal(3.300, floor.NetHeight);
        }

        [Fact]
        public void RoomVolume_UsesFloorHeightDirectly()
        {
            var room = new Room
            {
                Area = 150.0,
                Height = 3.600
            };

            // V = 150 * 3.6 = 540 м3
            Assert.Equal(540.0, room.Volume);
        }
    }
}
