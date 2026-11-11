using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.DataMapper
{
    public class HvacNormativeEngine
    {
        private readonly HttpClient _httpClient;
        private readonly string _llmUrl;

        public HvacNormativeEngine(HttpClient httpClient, string llmUrl = "http://llm-service:11434")
        {
            _httpClient = httpClient;
            _llmUrl = llmUrl;
        }

        public async Task ApplyNormsAsync(Room room)
        {
            string lower = (room.RawName ?? string.Empty).ToLowerInvariant();
            double vol = room.Volume;

            // 1. Подземная автостоянка / хранение автомобилей (СП 113.13330 / СП 60.13330)
            if (lower.Contains("автомобил") || lower.Contains("автостоянк") || lower.Contains("машино") || lower.Contains("паркинг"))
            {
                room.NormalizedType = $"Автостоянка ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020 / СП 113.13330";
                room.NormCitation = "Компенсационный приток K=4.0 1/ч, вытяжка по ПДК CO K=5.0 1/ч (дисбаланс -20%)";
                room.RequiredSupplyAir = Math.Round(vol * 4.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 5.0, 0);
                room.SystemTag = "П-Паркинг / В-Паркинг";
                return;
            }

            // 2. Комната уборочного инвентаря / ПУИ (вытяжка K=5, но не менее 100 м3/ч)
            if (lower.Contains("уборочн") || lower.Contains("пуи") || lower.Contains("уборка"))
            {
                room.NormalizedType = "ПУИ / Уборочный инвентарь";
                room.NormCode = "СП 118.13330.2022 п. 7.2";
                room.NormCitation = "Вытяжка L = 5*V, но не менее 100 м3/ч; приток перетоком";
                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = Math.Max(100, Math.Round(vol * 5.0, 0));
                room.SystemTag = "ВЕ-С/У";
                return;
            }

            // 3. Санузел раздельный / совмещенный
            if (lower.Contains("санузел") || lower.Contains("уборная") || lower.Contains("туалет") || lower.Contains("с/у"))
            {
                room.NormalizedType = "Санузел";
                room.NormCode = "СП 118.13330.2022 / СП 54.13330";
                room.NormCitation = "Фиксированная вытяжка 50–75 м3/ч на прибор, приток перетоком (разряжение)";
                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = Math.Max(75, Math.Round(vol * 5.0, 0));
                room.SystemTag = "ВЕ-С/У";
                return;
            }

            // 4. Электрощитовая / ИБП / СС / КУ АСО (вытяжка K=1, приток 0)
            if (lower.Contains("электрощитов") || lower.Contains("ибп") || lower.Contains("асо") || lower.Contains("коммуникаций ит") || lower.Contains("сс"))
            {
                room.NormalizedType = $"Электрощитовая / СС ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Ассимиляция теплоизбытков: вытяжка K=1.0 1/ч, приток не требуется (L_пр=0)";
                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = Math.Max(30, Math.Round(vol * 1.0, 0));
                room.SystemTag = "В-Тех";
                return;
            }

            // 5. Дизель-генераторная / Топливохранилище (В1)
            if (lower.Contains("дизель") || lower.Contains("топлив"))
            {
                room.NormalizedType = $"ДЭС / Топливная ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Технологический воздухообмен ДЭС: приток K=5.0 1/ч, вытяжка K=6.0 1/ч";
                room.RequiredSupplyAir = Math.Round(vol * 5.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 6.0, 0);
                room.SystemTag = "П-ДЭС / В-ДЭС";
                return;
            }

            // 6. Венткамера / Холодильный центр / Кондиционирование
            if (lower.Contains("венткамер") || lower.Contains("холодильн") || lower.Contains("кондиционир") || lower.Contains("аугпт"))
            {
                room.NormalizedType = $"Венткамера / ОВиК ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Собственные нужды венткамеры: приток K=1.0 1/ч, вытяжка K=1.0 1/ч";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 1.0, 0);
                room.SystemTag = "П1 / В1";
                return;
            }

            // 7. ИТП / Насосная / КНС / Водомерный узел
            if (lower.Contains("итп") || lower.Contains("тепловой") || lower.Contains("кнс") || lower.Contains("насос"))
            {
                room.NormalizedType = $"ИТП / КНС ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020 / СП 124.13330";
                room.NormCitation = "Вытяжка с мех. побуждением K=3.0 1/ч, компенсационный приток K=3.0 1/ч";
                room.RequiredSupplyAir = Math.Round(vol * 3.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 3.0, 0);
                room.SystemTag = "П-Тех / В-Тех";
                return;
            }

            // 8. Тамбур-шлюз / Лифтовый холл / Безопасная зона (подпор >= 100 м3/ч)
            if (lower.Contains("тамбур") || lower.Contains("лифтов") || lower.Contains("лестничн"))
            {
                room.NormalizedType = "МОП / Тамбур-шлюз";
                room.NormCode = "СП 60.13330.2020 / СП 7.13130";
                room.NormCitation = "Избыточное давление >= 20 Па (подпор не менее 100 м3/ч, вытяжка 0)";
                room.RequiredSupplyAir = Math.Max(100, Math.Round(vol * 1.5, 0));
                room.RequiredExhaustAir = 0;
                room.SystemTag = "П-МОП";
                return;
            }

            // 9. Кладовые / Склады / Пожарный инвентарь / Мусорокамера
            if (lower.Contains("кладов") || lower.Contains("склад") || lower.Contains("инвентар") || lower.Contains("мусор"))
            {
                room.NormalizedType = $"Склад / Кладовая ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Вытяжка K=1.5 1/ч (разряжение), приток K=1.0 1/ч";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 1.5, 0);
                room.SystemTag = "П1 / В-Склад";
                return;
            }

            // 10. Офисы / Кабинеты / Переговорные (по удельному расходу на человека 60 / 40 м3/ч)
            if (lower.Contains("офис") || lower.Contains("кабинет") || lower.Contains("переговор") || lower.Contains("диспетчер"))
            {
                int people = room.PeopleCount > 0 ? room.PeopleCount : Math.Max(1, (int)Math.Round(room.Area / 6.0));
                double normPerPerson = room.HasNaturalVentilation ? 40.0 : 60.0;
                double supply = Math.Max(people * normPerPerson, vol * 2.0);
                room.NormalizedType = "Офис / Рабочая зона";
                room.NormCode = "СП 60.13330.2020 / СанПиН 1.2.3685-21";
                room.NormCitation = $"{normPerPerson} м3/ч на чел. ({people} чел.), подпор +10%";
                room.RequiredSupplyAir = Math.Round(supply, 0);
                room.RequiredExhaustAir = Math.Round(supply * 0.9, 0);
                room.SystemTag = "П1 / В1";
                return;
            }

            // 11. Fallback к LLM (Gemini / Ollama) для нетиповых помещений
            await QueryLlmFallbackAsync(room);
        }

        private async Task QueryLlmFallbackAsync(Room room)
        {
            double vol = room.Volume;
            string prompt = $@"Ты инженер-проектировщик ОВиК высшей категории.
Дано помещение: ""{room.RawName}"", площадь: {room.Area} м2, высота: {room.EffectiveHeight} м, объем: {vol} м3.
Определи:
1. Профильный нормативный документ РФ (СП 60.13330.2020, СП 118.13330.2022, СП 54.13330.2022, СанПиН 1.2.3685-21).
2. Метод расчета (кратность, удельный расход на человека, фиксированный расход).
3. Кратность или расход притока (L_in, м3/ч).
4. Кратность или расход вытяжки (L_out, м3/ч).
5. Требование по дисбалансу (подпор или разряжение).
Ответь СТРОГО в формате JSON без разметки:
{{""normDoc"": ""..."", ""method"": ""..."", ""inflowRate"": number, ""exhaustRate"": number, ""notes"": ""...""}}";

            try
            {
                var payload = new { model = "qwen2.5-coder:14b", prompt = prompt, stream = false };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var resp = await _httpClient.PostAsync($"{_llmUrl}/api/generate", content);
                if (resp.IsSuccessStatusCode)
                {
                    var json = await resp.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("response", out var respProp))
                    {
                        var innerText = respProp.GetString() ?? "";
                        int sIdx = innerText.IndexOf('{');
                        int eIdx = innerText.LastIndexOf('}');
                        if (sIdx >= 0 && eIdx > sIdx)
                        {
                            using var normDoc = JsonDocument.Parse(innerText.Substring(sIdx, eIdx - sIdx + 1));
                            var root = normDoc.RootElement;
                            room.NormCode = root.TryGetProperty("normDoc", out var nd) ? (nd.GetString() ?? "СП 60.13330.2020") : "СП 60.13330.2020";
                            room.NormCitation = root.TryGetProperty("notes", out var nt) ? (nt.GetString() ?? "ИИ-классификация") : "ИИ-классификация";
                            room.RequiredSupplyAir = root.TryGetProperty("inflowRate", out var ir) && ir.ValueKind == JsonValueKind.Number ? ir.GetDouble() : Math.Round(vol * 1.5, 0);
                            room.RequiredExhaustAir = root.TryGetProperty("exhaustRate", out var er) && er.ValueKind == JsonValueKind.Number ? er.GetDouble() : Math.Round(vol * 1.5, 0);
                            room.NormalizedType = $"Тех. зона ({room.FireCategory})";
                            room.SystemTag = "П1 / В1";
                            return;
                        }
                    }
                }
            }
            catch
            {
                // Переход на резервный норматив при недоступности LLM
            }

            room.NormalizedType = $"Тех. помещение ({room.FireCategory})";
            room.NormCode = "СП 60.13330.2020";
            room.NormCitation = "Нормативный воздухообмен K=1.5 1/ч";
            room.RequiredSupplyAir = Math.Round(vol * 1.5, 0);
            room.RequiredExhaustAir = Math.Round(vol * 1.5, 0);
            room.SystemTag = "П1 / В1";
        }

        public EstimateSummaryDto BuildEstimate(IEnumerable<Room> rooms)
        {
            var list = rooms.ToList();
            var summary = new EstimateSummaryDto();

            double supplyGeneral = list.Where(r => !r.SystemTag.Contains("Паркинг")).Sum(r => r.RequiredSupplyAir);
            double supplyParking = list.Where(r => r.SystemTag.Contains("Паркинг")).Sum(r => r.RequiredSupplyAir);
            double exhaustGeneral = list.Where(r => r.SystemTag != "ВЕ-С/У" && !r.SystemTag.Contains("Паркинг")).Sum(r => r.RequiredExhaustAir);
            double exhaustSanitary = list.Where(r => r.SystemTag == "ВЕ-С/У").Sum(r => r.RequiredExhaustAir);
            double exhaustParking = list.Where(r => r.SystemTag.Contains("Паркинг")).Sum(r => r.RequiredExhaustAir);

            if (supplyGeneral > 0)
            {
                summary.Systems.Add(new HvacSystemGroupDto
                {
                    SystemCode = "П1",
                    SystemType = "Приточная общеобменная",
                    ServedRooms = "Тех. помещения, МОП, венткамеры, кладовые",
                    BaseAirflow = supplyGeneral,
                    RecommendedMetalThickness = supplyGeneral > 3000 ? "0.7 мм (СП 60.13330)" : "0.5 мм (СП 60.13330)",
                    SelectedUnitModel = $"ПВУ-К-{Math.Ceiling(supplyGeneral * 1.1 / 500) * 500} (H=450 Па, водяной калорифер, фильтр F7)"
                });
            }

            if (supplyParking > 0)
            {
                summary.Systems.Add(new HvacSystemGroupDto
                {
                    SystemCode = "П2-АС",
                    SystemType = "Приточная подземной автостоянки",
                    ServedRooms = "Помещения хранения автомобилей (В2)",
                    BaseAirflow = supplyParking,
                    RecommendedMetalThickness = "0.9 мм (огнестойкие транзит EI60)",
                    SelectedUnitModel = $"АПК-П-{Math.Ceiling(supplyParking * 1.1 / 1000) * 1000} (H=600 Па, ОЗК EI60)"
                });
            }

            if (exhaustGeneral > 0)
            {
                summary.Systems.Add(new HvacSystemGroupDto
                {
                    SystemCode = "В1",
                    SystemType = "Вытяжная общеобменная",
                    ServedRooms = "Тех. помещения, электрощитовые, кладовые, ДЭС",
                    BaseAirflow = exhaustGeneral,
                    RecommendedMetalThickness = exhaustGeneral > 3000 ? "0.7 мм (СП 60.13330)" : "0.5 мм (СП 60.13330)",
                    SelectedUnitModel = $"ВР-80-75 / ВКП-{Math.Ceiling(exhaustGeneral * 1.1 / 500) * 500} (H=400 Па)"
                });
            }

            if (exhaustSanitary > 0)
            {
                summary.Systems.Add(new HvacSystemGroupDto
                {
                    SystemCode = "ВЕ-С/У",
                    SystemType = "Вытяжная санузлов и ПУИ (изолированная по СП 60)",
                    ServedRooms = "Санузлы, ПУИ, комнаты уборочного инвентаря",
                    BaseAirflow = exhaustSanitary,
                    RecommendedMetalThickness = "0.5 мм (оцинкованная сталь)",
                    SelectedUnitModel = $"ВКК-160/200 ({Math.Round(exhaustSanitary * 1.1, 0)} м3/ч, H=300 Па)"
                });
            }

            if (exhaustParking > 0)
            {
                summary.Systems.Add(new HvacSystemGroupDto
                {
                    SystemCode = "В2-АС",
                    SystemType = "Вытяжная подземной автостоянки (верхняя и нижняя зоны)",
                    ServedRooms = "Помещения хранения автомобилей (В2)",
                    BaseAirflow = exhaustParking,
                    RecommendedMetalThickness = "0.9 мм (СП 60.13330)",
                    SelectedUnitModel = $"ВР-АС-{Math.Ceiling(exhaustParking * 1.1 / 1000) * 1000} (взрывозащищенный, H=550 Па)"
                });
            }

            int pos = 1;
            foreach (var sys in summary.Systems)
            {
                double unitCost = sys.SystemType.Contains("Приточная")
                    ? 185000 + sys.TotalAirflowWithReserve * 28.0
                    : 68000 + sys.TotalAirflowWithReserve * 14.0;

                summary.Items.Add(new EstimateLineItemDto
                {
                    Position = pos++,
                    Section = "1. Оборудование",
                    Name = $"Установка вентиляционная {sys.SystemCode}",
                    Specification = $"{sys.SelectedUnitModel}, L={sys.TotalAirflowWithReserve} м3/ч",
                    Unit = "компл.",
                    Quantity = 1,
                    UnitPrice = Math.Round(unitCost, 0)
                });
            }

            double totalDuctArea = Math.Max(25.0, summary.Systems.Sum(s => s.GalvanizedSteelArea));
            int ozkCount = Math.Max(2, list.Count(r => r.FireCategory.StartsWith("В")));
            int damperCount = Math.Max(4, list.Count);
            int grilleCount = Math.Max(6, list.Count * 2);

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "2. Вентиляционная сеть",
                Name = "Воздуховоды из оцинкованной стали класса Н и П (СП 60.13330)",
                Specification = "Толщина стали 0.5 / 0.7 / 0.9 мм, включая фасонные части (отводы, переходы, тройники)",
                Unit = "м²",
                Quantity = Math.Round(totalDuctArea, 1),
                UnitPrice = 2450
            });

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "2. Вентиляционная сеть",
                Name = "Клапаны противопожарные огнезадерживающие (ОЗК EI60)",
                Specification = "Нормально открытые с электроприводом Belimo 230В и возвратной пружиной",
                Unit = "шт.",
                Quantity = ozkCount,
                UnitPrice = 16800
            });

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "2. Вентиляционная сеть",
                Name = "Дроссель-клапаны воздушные регулировочные",
                Specification = "Оцинкованная сталь, ручной сектор управления на ответвлениях",
                Unit = "шт.",
                Quantity = damperCount,
                UnitPrice = 1850
            });

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "3. Воздухораспределители",
                Name = "Решетки приточно-вытяжные и потолочные диффузоры (АМН / ДПУ)",
                Specification = "Алюминиевые двухрядные с камерой статического давления (КСД)",
                Unit = "шт.",
                Quantity = grilleCount,
                UnitPrice = 3400
            });

            summary.EquipmentTotal = summary.Items.Where(i => i.Section.StartsWith("1.")).Sum(i => i.TotalPrice);
            summary.MaterialsTotal = summary.Items.Where(i => i.Section.StartsWith("2.") || i.Section.StartsWith("3.")).Sum(i => i.TotalPrice);
            summary.InstallationTotal = Math.Round((summary.EquipmentTotal + summary.MaterialsTotal) * 0.40, 0);
            summary.CommissioningTotal = Math.Round(summary.InstallationTotal * 0.12, 0);

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "4. Монтаж и ПНР",
                Name = "Строительно-монтажные работы систем ОВиК (40%)",
                Specification = "Монтаж оборудования, воздуховодов, клапанов ОЗК и обвязка узлов",
                Unit = "компл.",
                Quantity = 1,
                UnitPrice = summary.InstallationTotal
            });

            summary.Items.Add(new EstimateLineItemDto
            {
                Position = pos++,
                Section = "4. Монтаж и ПНР",
                Name = "Пусконаладочные работы и паспортизация систем по ГОСТ (12%)",
                Specification = "Аэродинамические испытания, настройка дросселей и выпуск паспортов вентустановок",
                Unit = "компл.",
                Quantity = 1,
                UnitPrice = summary.CommissioningTotal
            });

            return summary;
        }
    }
}