using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.DataMapper
{
    public class RoomMergeService
    {
        private readonly LlmSemanticMapper _llmMapper;
        private readonly HvacNormativeEngine _normativeEngine;

        public RoomMergeService(LlmSemanticMapper llmMapper)
        {
            _llmMapper = llmMapper;
            _normativeEngine = new HvacNormativeEngine(new HttpClient());
        }

        public async Task<List<Room>> MergeAsync(IEnumerable<Room> planRooms, Dictionary<string, RoomAttributes> excelData)
        {
            var mergedRooms = new List<Room>();

            foreach (var room in planRooms)
            {
                if (excelData != null && excelData.TryGetValue(room.Number, out var attr))
                {
                    if (!string.IsNullOrWhiteSpace(attr.RawType))
                        room.RawName = attr.RawType;

                    if (attr.AreaOverride.HasValue && attr.AreaOverride.Value > 0)
                        room.Area = attr.AreaOverride.Value;

                    room.Height = attr.HeightOverride ?? room.Height;
                    room.PeopleCount = attr.PeopleCount;
                    room.HasNaturalVentilation = attr.HasNaturalVentilation;
                }

                await _normativeEngine.ApplyNormsAsync(room);
                mergedRooms.Add(room);
            }

            return mergedRooms;
        }
    }
}