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
                room.CalculationMethod = "Кратность (Kпр=4.0, Kвыт=5.0)";
                room.RequiredSupplyAir = Math.Round(vol * 4.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 5.0, 0);
                room.CalculationFormula = $"Lпр = 4.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 5.0 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Паркинг / В-Паркинг";
                return;
            }

            // 2. Комната уборочного инвентаря / ПУИ (вытяжка K=5, но не менее 100 м3/ч)
            if (lower.Contains("уборочн") || lower.Contains("пуи") || lower.Contains("уборка"))
            {
                room.NormalizedType = "ПУИ / Уборочный инвентарь";
                room.NormCode = "СП 118.13330.2022 п. 7.2";
                room.NormCitation = "Вытяжка L = 5*V, но не менее 100 м3/ч; приток перетоком";
                room.CalculationMethod = "По кратности K=5.0 (min 100 м³/ч)";
                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = Math.Max(100, Math.Round(vol * 5.0, 0));
                room.CalculationFormula = $"Lвыт = max(100, 5.0 × {vol}) = {room.RequiredExhaustAir} м³/ч; Lпр = 0 (переток)";
                room.SystemTag = "ВЕ-С/У";
                return;
            }

            // 3. Санузел раздельный / совмещенный / душевая (СП 118.13330.2022 табл. 7.1, СП 44.13330.2011)
            if (lower.Contains("санузел") || lower.Contains("уборная") || lower.Contains("туалет") || lower.Contains("с/у") || lower.Contains("душев"))
            {
                room.NormalizedType = lower.Contains("душ") ? "Душевая" : "Санузел";
                room.NormCode = "СП 118.13330.2022 табл. 7.1 / СП 44.13330.2011";
                room.NormCitation = "50 м³/ч на 1 унитаз, 25 м³/ч на 1 писсуар, 75 м³/ч на 1 душ.сетку (СП 118.13330 / СП 44.13330)";
                room.CalculationMethod = "По сан. приборам (СП 118.13330)";

                // Автоопределение сан. приборов, если не заданы вручную
                if (room.ToiletCount == 0 && room.UrinalCount == 0 && room.ShowerCount == 0 && room.SinkCount == 0)
                {
                    if (lower.Contains("душ"))
                    {
                        room.ShowerCount = Math.Max(1, (int)Math.Round(room.Area / 3.0));
                    }
                    else if (lower.Contains("женск"))
                    {
                        room.ToiletCount = Math.Max(1, (int)Math.Round(room.Area / 3.0));
                    }
                    else if (lower.Contains("мужск"))
                    {
                        room.ToiletCount = Math.Max(1, (int)Math.Round(room.Area / 4.0));
                        room.UrinalCount = Math.Max(1, (int)Math.Round(room.Area / 4.0));
                    }
                    else
                    {
                        room.ToiletCount = 1;
                        if (room.Area >= 3.0) room.UrinalCount = 1;
                    }
                }

                double exhaust = (room.ToiletCount * 50.0) + (room.UrinalCount * 25.0) + (room.ShowerCount * 75.0) + (room.SinkCount * 20.0);
                if (exhaust < 50.0) exhaust = 50.0;

                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = exhaust;

                var formulaParts = new List<string>();
                if (room.ToiletCount > 0) formulaParts.Add($"{room.ToiletCount} унит × 50");
                if (room.UrinalCount > 0) formulaParts.Add($"{room.UrinalCount} писс × 25");
                if (room.ShowerCount > 0) formulaParts.Add($"{room.ShowerCount} душ × 75");
                if (room.SinkCount > 0) formulaParts.Add($"{room.SinkCount} умыв × 20");

                room.CalculationFormula = $"Lвыт = {string.Join(" + ", formulaParts)} = {exhaust} м³/ч; Lпр = 0 (переток по СП 118.13330)";
                room.SystemTag = "В-СУ";
                return;
            }

            // 4. Электрощитовая / ИБП / СС / КУ АСО (вытяжка K=1, приток 0)
            if (lower.Contains("электрощитов") || lower.Contains("ибп") || lower.Contains("асо") || lower.Contains("коммуникаций ит") || lower.Contains("сс"))
            {
                room.NormalizedType = $"Электрощитовая / СС ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020 / ПУЭ";
                room.NormCitation = "Ассимиляция теплоизбытков: вытяжка K=1.0 1/ч, приток не требуется (L_пр=0)";
                room.CalculationMethod = "Ассимиляция теплоизбытков (K=1.0)";
                room.RequiredSupplyAir = 0;
                room.RequiredExhaustAir = Math.Max(30, Math.Round(vol * 1.0, 0));
                room.CalculationFormula = $"Lвыт = 1.0 × {vol} = {room.RequiredExhaustAir} м³/ч; Lпр = 0 (мех. приток не требуется)";
                room.SystemTag = "В-Тех";
                return;
            }

            // 5. Дизель-генераторная / Топливохранилище (В1)
            if (lower.Contains("дизель") || lower.Contains("топлив"))
            {
                room.NormalizedType = $"ДЭС / Топливная ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Технологический воздухообмен ДЭС: приток K=5.0 1/ч, вытяжка K=6.0 1/ч";
                room.CalculationMethod = "Технологический воздухообмен (Kпр=5.0, Kвыт=6.0)";
                room.RequiredSupplyAir = Math.Round(vol * 5.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 6.0, 0);
                room.CalculationFormula = $"Lпр = 5.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 6.0 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-ДЭС / В-ДЭС";
                return;
            }

            // 6. Венткамера / Холодильный центр / АУГПТ
            if (lower.Contains("венткамер") || lower.Contains("холодильн") || lower.Contains("кондиционир") || lower.Contains("аугпт"))
            {
                room.NormalizedType = $"Венткамера / Тех ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020 п. 7.1";
                room.NormCitation = "Кратность воздухообмена: приток K=1.0 1/ч, вытяжка K=1.0 1/ч";
                room.CalculationMethod = "По кратности (K=1.0)";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 1.0, 0);
                room.CalculationFormula = $"Lпр = 1.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 1.0 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Тех / В-Тех";
                return;
            }

            // 7. ИТП / Насосная станция / Водомерный узел
            if (lower.Contains("итп") || lower.Contains("тепловой") || lower.Contains("насосн") || lower.Contains("кнс") || lower.Contains("водомер"))
            {
                room.NormalizedType = $"ИТП / Насосная ({room.FireCategory})";
                room.NormCode = "СП 41-101-95 / СП 60.13330.2020";
                room.NormCitation = "Кратность механической вентиляции: приток K=3.0, вытяжка K=3.0";
                room.CalculationMethod = "По кратности (K=3.0)";
                room.RequiredSupplyAir = Math.Round(vol * 3.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 3.0, 0);
                room.CalculationFormula = $"Lпр = 3.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 3.0 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Тех / В-Тех";
                return;
            }

            // 8. Тамбур-шлюз / Лифтовой холл с подпором
            if (lower.Contains("тамбур") || lower.Contains("лифтовой холл"))
            {
                room.NormalizedType = "Тамбур-шлюз / Лифтовой холл";
                room.NormCode = "СП 7.13130.2013 / СП 60.13330.2020";
                room.NormCitation = "Подпор воздуха при пожаре/избыточном давлении не менее 20 Па (L >= 100 м3/ч)";
                room.CalculationMethod = "Подпор воздуха (ΔP ≥ 20 Па)";
                room.RequiredSupplyAir = Math.Max(100, Math.Round(vol * 1.5, 0));
                room.RequiredExhaustAir = 0;
                room.CalculationFormula = $"Lпр = max(100, 1.5 × {vol}) = {room.RequiredSupplyAir} м³/ч; Lвыт = 0 (избыточное давление ≥ 20 Па)";
                room.SystemTag = "ПД-Подпор";
                return;
            }

            // 9. Офисные / Рабочие помещения / Переговорные (строго по людям по СП 60.13330 и СанПиН)
            if (lower.Contains("офис") || lower.Contains("кабинет") || lower.Contains("переговор") || lower.Contains("диспетчер") || lower.Contains("охрана") || lower.Contains("пост") || lower.Contains("администр"))
            {
                int people = room.PeopleCount > 0 
                    ? room.PeopleCount 
                    : Math.Max(1, (int)Math.Ceiling(room.Area / 6.0)); // 6 м2 на 1 раб. место по СанПиН 1.2.3685-21
                room.PeopleCount = people;

                double ratePerPerson = room.HasNaturalVentilation ? 40.0 : 60.0;
                room.NormalizedType = "Офис / Рабочее помещение";
                room.NormCode = "СП 60.13330.2020 п. 7.1 / СанПиН 1.2.3685-21";
                room.NormCitation = $"Санитарная норма по людям: {ratePerPerson} м³/ч на 1 человека ({people} чел. по СанПиН 1.2.3685-21, 6 м²/чел)";
                room.CalculationMethod = $"По числу людей ({people} чел × {ratePerPerson} м³/ч)";
                
                double flow = Math.Round(people * ratePerPerson, 0);
                room.RequiredSupplyAir = flow;
                room.RequiredExhaustAir = flow; // Баланс по СП 60.13330.2020
                room.CalculationFormula = $"Lпр = {people} чел × {ratePerPerson} = {flow} м³/ч; Lвыт = {flow} м³/ч (по балансу СП 60.13330 / СанПиН)";
                room.SystemTag = "П-Общ / В-Общ";
                return;
            }

            // 10. Кладовые / Склады / Помещения хранения
            if (lower.Contains("кладов") || lower.Contains("склад") || lower.Contains("мусор") || lower.Contains("инвентар") || lower.Contains("хранени") || lower.Contains("архив"))
            {
                room.NormalizedType = $"Кладовая / Склад ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020 / СП 54.13330.2022";
                room.NormCitation = "Кратность для складских зон: вытяжка K=1.5 1/ч, приток K=1.0 1/ч (разряжение)";
                room.CalculationMethod = "По кратности (Kпр=1.0, Kвыт=1.5)";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 1.5, 0);
                room.CalculationFormula = $"Lпр = 1.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 1.5 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Общ / В-Общ";
                return;
            }

            // 11. Коридоры / Холлы / Лестничные клетки / МОП
            if (lower.Contains("коридор") || lower.Contains("моп") || lower.Contains("лестнич") || lower.Contains("вестибюл"))
            {
                room.NormalizedType = "МОП / Коридор";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Общеобменная вентиляция коридоров: компенсационный приток K=1.0, вытяжка K=0.5";
                room.CalculationMethod = "По кратности (Kпр=1.0, Kвыт=0.5)";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 0.5, 0);
                room.CalculationFormula = $"Lпр = 1.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 0.5 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Общ / В-Общ";
                return;
            }

            // Если по паттернам не найдено — вызываем локальную нейросеть (Ollama)
            bool llmSuccess = await TryClassifyWithLlmAsync(room);
            if (!llmSuccess)
            {
                // Санитарный дефолт по СП 60.13330
                room.NormalizedType = $"Тех. помещение ({room.FireCategory})";
                room.NormCode = "СП 60.13330.2020";
                room.NormCitation = "Базовый санитарный воздухообмен K=1.0 1/ч";
                room.CalculationMethod = "По кратности (K=1.0)";
                room.RequiredSupplyAir = Math.Round(vol * 1.0, 0);
                room.RequiredExhaustAir = Math.Round(vol * 1.0, 0);
                room.CalculationFormula = $"Lпр = 1.0 × {vol} = {room.RequiredSupplyAir} м³/ч; Lвыт = 1.0 × {vol} = {room.RequiredExhaustAir} м³/ч";
                room.SystemTag = "П-Общ / В-Общ";
            }
        }

        private async Task<bool> TryClassifyWithLlmAsync(Room room)
        {
            try
            {
                var payload = new
                {
                    model = "llama3:8b",
                    prompt = $"Классифицируй помещение для вентиляции по СП 60.13330. Наименование: «{room.RawName}». Ответь JSON с полями normalizedType, normCode, supplyK, exhaustK, systemTag.",
                    stream = false,
                    format = "json"
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2.0));
                var response = await _httpClient.PostAsync($"{_llmUrl}/api/generate", content, cts.Token);

                if (!response.IsSuccessStatusCode) return false;

                var respString = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(respString);
                string responseText = doc.RootElement.GetProperty("response").GetString() ?? "";

                using var innerDoc = JsonDocument.Parse(responseText);
                var root = innerDoc.RootElement;

                room.NormalizedType = root.GetProperty("normalizedType").GetString() ?? "Помещение";
                room.NormCode = root.GetProperty("normCode").GetString() ?? "СП 60.13330.2020";
                double sk = root.GetProperty("supplyK").GetDouble();
                double ek = root.GetProperty("exhaustK").GetDouble();
                room.SystemTag = root.GetProperty("systemTag").GetString() ?? "П1/В1";

                room.RequiredSupplyAir = Math.Round(room.Volume * sk, 0);
                room.RequiredExhaustAir = Math.Round(room.Volume * ek, 0);
                room.CalculationMethod = $"LLM / По кратности (Kпр={sk}, Kвыт={ek})";
                room.CalculationFormula = $"Lпр = {sk} × {room.Volume} = {room.RequiredSupplyAir} м³/ч; Lвыт = {ek} × {room.Volume} = {room.RequiredExhaustAir} м³/ч";
                room.NormCitation = $"Классифицировано LLM (Kпр={sk}, Kвыт={ek})";
                return true;
            }
            catch
            {
                return false;
            }
        }

        public EstimateSummaryDto CalculateEstimate(IEnumerable<Room> rooms)
        {
            var summary = new EstimateSummaryDto();
            var list = rooms.ToList();
            if (!list.Any()) return summary;

            var sysGroups = list
                .GroupBy(r => r.SystemTag)
                .OrderBy(g => g.Key);

            int pos = 1;

            foreach (var g in sysGroups)
            {
                string sysCode = g.Key.Split('/')[0].Trim();
                double supplySum = g.Sum(r => r.RequiredSupplyAir);
                double exhaustSum = g.Sum(r => r.RequiredExhaustAir);
                double maxAirflow = Math.Max(supplySum, exhaustSum);

                string sysType = sysCode.StartsWith("П") ? "Приточная установка" : "Вытяжная установка";
                if (sysCode.Contains("Паркинг")) sysType = "Приточно-вытяжная система паркинга";
                if (sysCode.Contains("С/У") || sysCode.Contains("СУ")) sysType = "Вытяжная система санузлов";

                string served = string.Join(", ", g.Select(r => r.Number).Take(12));
                if (g.Count() > 12) served += $" и еще {g.Count() - 12} пом.";

                var sysDto = new HvacSystemGroupDto
                {
                    SystemCode = sysCode,
                    SystemType = sysType,
                    ServedRooms = served,
                    BaseAirflow = Math.Round(maxAirflow, 0),
                    SelectedUnitModel = $"ВЕНТ-МАСТЕР-{Math.Round(maxAirflow * 1.10 / 100) * 100}"
                };

                summary.Systems.Add(sysDto);

                double unitCost = sysDto.TotalAirflowWithReserve > 5000
                    ? 180000 + sysDto.TotalAirflowWithReserve * 28.5
                    : 68000 + sysDto.TotalAirflowWithReserve * 14.0;

                summary.Items.Add(new EstimateLineItemDto
                {
                    Position = pos++,
                    Section = "1. Оборудование",
                    Name = $"Установка вентиляционная {sysDto.SystemCode}",
                    Specification = $"{sysDto.SelectedUnitModel}, L={sysDto.TotalAirflowWithReserve} м3/ч",
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
