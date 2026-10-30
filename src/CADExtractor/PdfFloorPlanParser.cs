using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HvacAutoCalculator.Domain.Interfaces;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.CADExtractor
{
    public class PdfFloorPlanParser : IExtractor
    {
        private static readonly Regex ObjRegex = new(@"(\d+)\s+0\s+obj\b([\s\S]*?)endobj", RegexOptions.Compiled);
        private static readonly Regex FontMapRegex = new(@"/(F\d+)\s+(\d+)\s+0\s+R", RegexOptions.Compiled);
        private static readonly Regex ToUnicodeRefRegex = new(@"/ToUnicode\s+(\d+)\s+0\s+R", RegexOptions.Compiled);
        private static readonly Regex BfCharRegex = new(@"<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>", RegexOptions.Compiled);

        private static readonly Regex TfRegex = new(@"/(F\d+)\s+([0-9\.]+)\s+Tf", RegexOptions.Compiled);
        private static readonly Regex TmRegex = new(@"([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+Tm", RegexOptions.Compiled);
        private static readonly Regex HexTjRegex = new(@"<([0-9a-fA-F]+)>\s*Tj", RegexOptions.Compiled);
        private static readonly Regex LiteralTjRegex = new(@"\(([^\(\)\\]+)\)\s*Tj", RegexOptions.Compiled);

        // Формат номеров помещений из экспликации (-3.01, -3.22а, 1.02, 101 и т.д.)
        private static readonly Regex ExplicationRoomNumRegex = new(@"^(-?[0-9]{1,3}\.[0-9]{2}[а-яА-Яa-zA-Z]?|[0-9]{1,4}[а-яА-Яa-zA-Z]?)$", RegexOptions.Compiled);
        private static readonly Regex AreaRegex = new(@"^([0-9]{1,5}[\.,][0-9]{2})$", RegexOptions.Compiled);
        private static readonly Regex FireCatRegex = new(@"^(В[1-4]|Д|А|Б|Г|-)$", RegexOptions.Compiled);

        private class PdfTextToken
        {
            public double X { get; set; }
            public double Y { get; set; }
            public string Font { get; set; } = "F1";
            public string Text { get; set; } = string.Empty;
        }

        public Task<IEnumerable<Room>> ExtractGeometryAsync(string filePath)
        {
            return ExtractGeometryWithScaleAsync(filePath, 200.0);
        }

        public Task<IEnumerable<Room>> ExtractGeometryWithScaleAsync(string filePath, double scaleDenominator = 200.0)
        {
            byte[] rawBytes = File.ReadAllBytes(filePath);
            string rawLatin = Encoding.Latin1.GetString(rawBytes);

            // 1. Индексируем все PDF-объекты
            var objects = new Dictionary<int, (string Body, int StartOffset)>();
            foreach (Match m in ObjRegex.Matches(rawLatin))
            {
                int id = int.Parse(m.Groups[1].Value);
                objects[id] = (m.Groups[2].Value, m.Groups[2].Index);
            }

            // 2. Строим таблицы перекодировки ToUnicode CMap для каждого шрифта (F1, F2, F3...)
            var fontToObj = new Dictionary<string, int>();
            foreach (var kvp in objects)
            {
                if (kvp.Value.Body.Contains("/Font"))
                {
                    foreach (Match fm in FontMapRegex.Matches(kvp.Value.Body))
                    {
                        fontToObj[fm.Groups[1].Value] = int.Parse(fm.Groups[2].Value);
                    }
                }
            }

            var fontCmaps = new Dictionary<string, Dictionary<int, char>>();
            foreach (var kvp in fontToObj)
            {
                string fontName = kvp.Key;
                int fontObjId = kvp.Value;
                if (!objects.TryGetValue(fontObjId, out var fontObj)) continue;

                var tuMatch = ToUnicodeRefRegex.Match(fontObj.Body);
                if (!tuMatch.Success) continue;

                int tuObjId = int.Parse(tuMatch.Groups[1].Value);
                if (!objects.TryGetValue(tuObjId, out var tuObj)) continue;

                string cmapContent = DecompressObjectStream(rawBytes, rawLatin, tuObj.Body, tuObj.StartOffset);
                var cmap = new Dictionary<int, char>();
                foreach (Match bm in BfCharRegex.Matches(cmapContent))
                {
                    int cid = Convert.ToInt32(bm.Groups[1].Value, 16);
                    int uni = Convert.ToInt32(bm.Groups[2].Value, 16);
                    cmap[cid] = (char)uni;
                }
                fontCmaps[fontName] = cmap;
            }

            // 3. Извлекаем все текстовые элементы с координатами (X, Y) из потоков страницы
            var tokens = new List<PdfTextToken>();
            foreach (var kvp in objects)
            {
                if (!kvp.Value.Body.Contains("stream")) continue;
                string streamText = DecompressObjectStream(rawBytes, rawLatin, kvp.Value.Body, kvp.Value.StartOffset);
                if (string.IsNullOrEmpty(streamText) || !streamText.Contains("Tj")) continue;

                string curFont = "F1";
                double curX = 0, curY = 0;

                foreach (var line in streamText.Split('\n'))
                {
                    var tf = TfRegex.Match(line);
                    if (tf.Success) curFont = tf.Groups[1].Value;

                    var tm = TmRegex.Match(line);
                    if (tm.Success)
                    {
                        curX = ParseDouble(tm.Groups[5].Value, curX);
                        curY = ParseDouble(tm.Groups[6].Value, curY);
                    }

                    var hexTj = HexTjRegex.Match(line);
                    if (hexTj.Success)
                    {
                        string decoded = DecodeCidHex(hexTj.Groups[1].Value, fontCmaps.GetValueOrDefault(curFont));
                        if (!string.IsNullOrWhiteSpace(decoded))
                        {
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = decoded.Trim() });
                        }
                        continue;
                    }

                    var litTj = LiteralTjRegex.Match(line);
                    if (litTj.Success)
                    {
                        string txt = litTj.Groups[1].Value.Trim();
                        if (!string.IsNullOrWhiteSpace(txt))
                        {
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = txt });
                        }
                    }
                }
            }

            // 4. Собираем метки номеров комнат на самом чертеже (X > 6600)
            var planTokens = tokens.Where(t => t.X > 6600).ToList();
            var planRoomCoordinates = new Dictionary<string, (double X, double Y)>(StringComparer.OrdinalIgnoreCase);

            for (int i = 0; i < planTokens.Count; i++)
            {
                var t = planTokens[i];
                if (Regex.IsMatch(t.Text, @"^-?[0-9]{1,2}\.[0-9]{2}$"))
                {
                    string roomNum = t.Text;
                    // Проверяем, нет ли рядом одиночной буквы суффикса (например "-3.22" + "а" или "в")
                    var suffix = planTokens.FirstOrDefault(other =>
                        Math.Abs(other.X - t.X) < 25 &&
                        (t.Y - other.Y) > 50 && (t.Y - other.Y) < 260 &&
                        Regex.IsMatch(other.Text, @"^[а-яА-Яa-zA-Z]$"));

                    if (suffix != null)
                        roomNum += suffix.Text;

                    if (!planRoomCoordinates.ContainsKey(roomNum))
                        planRoomCoordinates[roomNum] = (t.X, t.Y);
                }
            }

            // 5. Парсим таблицу «Экспликация помещений» внутри PDF (X <= 6600)
            var expTokens = tokens.Where(t => t.X <= 6600).ToList();
            var rooms = new List<Room>();
            var seenNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var roomNumCandidates = expTokens
                .Where(t => t.X > 850 && t.X < 6150 && Regex.IsMatch(t.Text, @"^-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?$"))
                .OrderByDescending(t => t.Y)
                .ThenByDescending(t => t.X)
                .ToList();

            int orderIdx = 0;
            foreach (var numTok in roomNumCandidates)
            {
                // Отсекаем технические коды (если справа нет площади в этой же строке)
                var rowItems = expTokens.Where(t => Math.Abs(t.X - numTok.X) <= 85 && (numTok.Y - t.Y) > 100 && (numTok.Y - t.Y) < 4200).ToList();

                var areaTok = rowItems.FirstOrDefault(t =>
                    (numTok.Y - t.Y) >= 2200 && (numTok.Y - t.Y) <= 3300 &&
                    AreaRegex.IsMatch(t.Text));

                if (areaTok == null) continue;
                if (seenNumbers.Contains(numTok.Text)) continue;
                seenNumbers.Add(numTok.Text);

                double areaVal = ParseDouble(areaTok.Text.Replace(',', '.'), 0);

                // Собираем наименование помещения (может состоять из 1 или 2 строк)
                var nameParts = rowItems
                    .Where(t => (numTok.Y - t.Y) >= 200 && (numTok.Y - t.Y) < 2000 && !AreaRegex.IsMatch(t.Text))
                    .OrderByDescending(t => t.X)
                    .Select(t => t.Text)
                    .ToList();

                string roomName = nameParts.Any() ? string.Join(" ", nameParts) : $"Помещение {numTok.Text}";

                // Категория помещения (В1, В2, В3, В4, Д, -)
                var catTok = rowItems.FirstOrDefault(t =>
                    (numTok.Y - t.Y) > 3100 && (numTok.Y - t.Y) <= 4000 &&
                    FireCatRegex.IsMatch(t.Text));
                string fireCat = catTok != null ? catTok.Text : "-";

                // Координаты на плане этажа (пересчет из повернутой на 270° CAD-сетки в % экрана)
                double boxX, boxY;
                string source;
                if (planRoomCoordinates.TryGetValue(numTok.Text, out var coords))
                {
                    // Y в CAD идет слева направо от 38800 до 6200, X идет сверху вниз от 18200 до 6600
                    boxX = Math.Clamp(((38800.0 - coords.Y) / 32600.0) * 88.0 + 3.0, 2.0, 88.0);
                    boxY = Math.Clamp(((18200.0 - coords.X) / 11600.0) * 82.0 + 4.0, 3.0, 84.0);
                    source = $"Экспликация PDF + План (Кат. {fireCat})";
                }
                else
                {
                    int col = orderIdx % 8;
                    int row = orderIdx / 8;
                    boxX = 4.0 + col * 11.5;
                    boxY = 8.0 + row * 14.0;
                    source = $"Экспликация PDF (Кат. {fireCat})";
                }
                orderIdx++;

                string normCategory = InferSpCategory(roomName, fireCat);
                double height = roomName.ToLower().Contains("автомобил") ? 3.6 : 3.3;

                rooms.Add(new Room
                {
                    RoomId = Guid.NewGuid(),
                    CadId = $"EXP-{orderIdx}",
                    Number = numTok.Text,
                    RawName = roomName,
                    NormalizedType = normCategory,
                    Area = Math.Round(areaVal, 2),
                    Height = height,
                    BoxX = Math.Round(boxX, 1),
                    BoxY = Math.Round(boxY, 1),
                    BoxWidth = areaVal > 500 ? 18.0 : 10.5,
                    BoxHeight = areaVal > 500 ? 16.0 : 11.0,
                    DetectionSource = source
                });
            }

            return Task.FromResult<IEnumerable<Room>>(rooms);
        }

        private static string InferSpCategory(string name, string fireCat)
        {
            string lower = name.ToLowerInvariant();
            if (lower.Contains("автомобил") || lower.Contains("автостоянк")) return "Автостоянка";
            if (lower.Contains("санузел") || lower.Contains("уборн")) return "Санузел";
            if (lower.Contains("венткамера") || lower.Contains("холодильн") || lower.Contains("кондиционир")) return "Венткамера / ОВиК";
            if (lower.Contains("электрощитов") || lower.Contains("ибп") || lower.Contains("дизель")) return "Электрощитовая / ДЭС";
            if (lower.Contains("тамбур") || lower.Contains("лестничн") || lower.Contains("лифтов")) return "МОП / Тамбур-шлюз";
            if (lower.Contains("кнс") || lower.Contains("насос")) return "Насосная / КНС";
            if (lower.Contains("склад") || lower.Contains("инвентар") || lower.Contains("уборочн")) return $"Склад ({fireCat})";
            return $"Тех. помещение ({fireCat})";
        }

        private static string DecodeCidHex(string hex, Dictionary<int, char>? cmap)
        {
            var sb = new StringBuilder();
            for (int i = 0; i + 4 <= hex.Length; i += 4)
            {
                int cid = Convert.ToInt32(hex.Substring(i, 4), 16);
                if (cmap != null && cmap.TryGetValue(cid, out char ch))
                    sb.Append(ch);
            }
            return sb.ToString();
        }

        private static string DecompressObjectStream(byte[] allBytes, string allLatin, string objBody, int objOffset)
        {
            int relStream = objBody.IndexOf("stream", StringComparison.Ordinal);
            if (relStream < 0) return objBody;

            string header = objBody.Substring(0, relStream);
            int absStart = objOffset + relStream + 6;
            if (absStart < allLatin.Length && allLatin[absStart] == '\r') absStart++;
            if (absStart < allLatin.Length && allLatin[absStart] == '\n') absStart++;

            int absEnd = allLatin.IndexOf("endstream", absStart, StringComparison.Ordinal);
            if (absEnd < 0) return string.Empty;

            int len = absEnd - absStart;
            while (len > 0 && (allBytes[absStart + len - 1] == '\r' || allBytes[absStart + len - 1] == '\n'))
                len--;

            if (!header.Contains("/FlateDecode"))
            {
                return Encoding.Latin1.GetString(allBytes, absStart, len);
            }

            try
            {
                using var ms = new MemoryStream(allBytes, absStart, len);
                using var zlib = new ZLibStream(ms, CompressionMode.Decompress);
                using var sr = new StreamReader(zlib, Encoding.Latin1);
                return sr.ReadToEnd();
            }
            catch
            {
                return string.Empty;
            }
        }

        private static double ParseDouble(string s, double fallback)
        {
            return double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out double v) ? v : fallback;
        }
    }
}
