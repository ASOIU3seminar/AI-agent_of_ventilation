using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.DataMapper
{
    public class RoomMergeService
    {
        private readonly LlmSemanticMapper _llmMapper;

        public RoomMergeService(LlmSemanticMapper llmMapper)
        {
            _llmMapper = llmMapper;
        }

        public async Task<List<Room>> MergeAsync(IEnumerable<Room> cadRooms, Dictionary<string, RoomAttributes> excelData)
        {
            var mergedRooms = new List<Room>();

            foreach (var room in cadRooms)
            {
                if (excelData.TryGetValue(room.Number, out var attr))
                {
                    room.RawName = attr.RawType;
                    room.Height = attr.HeightOverride ?? room.Height;
                    room.PeopleCount = attr.PeopleCount;
                    room.HasNaturalVentilation = attr.HasNaturalVentilation;
                    
                    // Нормализация через DeepSeek (Санузел, Офис, Склад и т.д.)
                    room.NormalizedType = await _llmMapper.NormalizeRoomTypeAsync(attr.RawType);
                }
                mergedRooms.Add(room);
            }
            return mergedRooms;
        }
    }
}