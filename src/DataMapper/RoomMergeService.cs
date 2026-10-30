using System;
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

        public Task<List<Room>> MergeAsync(IEnumerable<Room> planRooms, Dictionary<string, RoomAttributes> excelData)
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

                if (string.IsNullOrWhiteSpace(room.NormalizedType))
                {
                    room.NormalizedType = ClassifyByRussianName(room.RawName);
                }

                // Расчет воздухообмена по типу помещения из экспликации
                double volume = room.Area * room.Height;
                if (room.NormalizedType.Contains("Санузел"))
                {
                    room.RequiredSupplyAir = 0;
                    room.RequiredExhaustAir = Math.Round(Math.Max(50, volume * 5.0), 0);
                }
                else if (room.NormalizedType.Contains("Автостоянка"))
                {
                    room.RequiredSupplyAir = Math.Round(volume * 1.5, 0);
                    room.RequiredExhaustAir = Math.Round(volume * 1.8, 0);
                }
                else if (room.NormalizedType.Contains("Тамбур"))
                {
                    room.RequiredSupplyAir = Math.Round(volume * 1.0, 0);
                    room.RequiredExhaustAir = 0;
                }
                else
                {
                    room.RequiredSupplyAir = Math.Round(volume * 1.5, 0);
                    room.RequiredExhaustAir = Math.Round(volume * 1.5, 0);
                }

                mergedRooms.Add(room);
            }

            return Task.FromResult(mergedRooms);
        }

        private static string ClassifyByRussianName(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "Помещение";
            var lower = raw.ToLowerInvariant();
            if (lower.Contains("автомобил") || lower.Contains("автостоянк")) return "Автостоянка";
            if (lower.Contains("санузел") || lower.Contains("уборн")) return "Санузел";
            if (lower.Contains("венткамер") || lower.Contains("холодильн") || lower.Contains("кондиционир")) return "Венткамера / ОВиК";
            if (lower.Contains("электрощитов") || lower.Contains("ибп") || lower.Contains("дизель")) return "Электрощитовая / ДЭС";
            if (lower.Contains("тамбур") || lower.Contains("лестничн") || lower.Contains("лифтов")) return "МОП / Тамбур-шлюз";
            if (lower.Contains("склад") || lower.Contains("инвентар")) return "Склад";
            return "Тех. помещение";
        }
    }
}