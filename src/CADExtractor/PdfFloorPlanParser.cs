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

        private static readonly Regex TfRegex = new(@"/(F\d+)\s+[0-9\.]+\s+Tf", RegexOptions.Compiled);
        private static readonly Regex TmRegex = new(@"([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+Tm", RegexOptions.Compiled);
        private static readonly Regex HexTjRegex = new(@"<([0-9a-fA-F]+)>\s*Tj", RegexOptions.Compiled);
        private static readonly Regex LiteralTjRegex = new(@"\(([^\(\)\\]+)\)\s*Tj", RegexOptions.Compiled);

        // Паттерны для классификации токенов
        private static readonly Regex RoomPattern = new(@"^(-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?|-[0-9]{2}\.[A-Za-zА-Яа-я0-9]{2}\.[0-9]{1,3}|[0-9]{1,2}\.[A-Za-z0-9]+\.[0-9]{1,3})$", RegexOptions.Compiled);
        private static readonly Regex CompositeBasePattern = new(@"^-?[0-9]{1,2}\.[0-9]{2}$", RegexOptions.Compiled);
        private static readonly Regex CompositeSuffixPattern = new(@"^[а-яА-Яa-zA-Z]$", RegexOptions.Compiled);
        
        private static readonly Regex AreaRegex = new(@"^[0-9]{1,5}[\.,][0-9]{2}$", RegexOptions.Compiled);
        private static readonly Regex FireCatRegex = new(@"^(В[1-4]|Д|А|Б|Г|-)$", RegexOptions.Compiled);
        private static readonly Regex JunkRegex = new(@"^([-+]?\d+([.,]\d+)?|\d+:\d+)$", RegexOptions.Compiled);

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

            var objects = new Dictionary<int, (string Body, int StartOffset)>();
            foreach (Match m in ObjRegex.Matches(rawLatin))
            {
                int id = int.Parse(m.Groups[1].Value);
                objects[id] = (m.Groups[2].Value, m.Groups[2].Index);
            }

            var fontToObj = new Dictionary<string, int>();
            foreach (var kvp in objects.Where(x => x.Value.Body.Contains("/Font")))
            {
                foreach (Match fm in FontMapRegex.Matches(kvp.Value.Body))
                {
                    fontToObj[fm.Groups[1].Value] = int.Parse(fm.Groups[2].Value);
                }
            }

            var fontCmaps = new Dictionary<string, Dictionary<int, char>>();
            foreach (var kvp in fontToObj)
            {
                if (!objects.TryGetValue(kvp.Value, out var fontObj)) continue;
                var tuMatch = ToUnicodeRefRegex.Match(fontObj.Body);
                if (!tuMatch.Success || !objects.TryGetValue(int.Parse(tuMatch.Groups[1].Value), out var tuObj)) continue;

                string cmapContent = DecompressObjectStream(rawBytes, rawLatin, tuObj.Body, tuObj.StartOffset);
                var cmap = new Dictionary<int, char>();
                foreach (Match bm in BfCharRegex.Matches(cmapContent))
                {
                    cmap[Convert.ToInt32(bm.Groups[1].Value, 16)] = (char)Convert.ToInt32(bm.Groups[2].Value, 16);
                }
                fontCmaps[kvp.Key] = cmap;
            }

            var tokens = new List<PdfTextToken>();
            foreach (var kvp in objects.Where(x => x.Value.Body.Contains("stream")))
            {
                string streamText = DecompressObjectStream(rawBytes, rawLatin, kvp.Value.Body, kvp.Value.StartOffset);
                if (string.IsNullOrEmpty(streamText) || (!streamText.Contains("Tj") && !streamText.Contains("TJ"))) continue;

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
                        string decoded = DecodeCidHex(hexTj.Groups[1].Value, fontCmaps.GetValueOrDefault(curFont, new Dictionary<int, char>()));
                        if (!string.IsNullOrWhiteSpace(decoded))
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = decoded.Trim() });
                    }
                    else
                    {
                        var litTj = LiteralTjRegex.Match(line);
                        if (litTj.Success && !string.IsNullOrWhiteSpace(litTj.Groups[1].Value))
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = litTj.Groups[1].Value.Trim() });
                    }
                }
            }

            foreach (var t in tokens.Where(x => CompositeBasePattern.IsMatch(x.Text)))
            {
                var suffix = tokens.FirstOrDefault(o => o != t && Math.Abs(o.X - t.X) < 50 && (t.Y - o.Y) > 20 && (t.Y - o.Y) < 300 && CompositeSuffixPattern.IsMatch(o.Text));
                if (suffix != null)
                {
                    t.Text += suffix.Text;
                    suffix.Text = "";
                }
            }
            tokens.RemoveAll(t => string.IsNullOrWhiteSpace(t.Text));

            var allRoomTokens = tokens.Where(t => RoomPattern.IsMatch(t.Text)).ToList();
            var planCoords = new Dictionary<string, PdfTextToken>(StringComparer.OrdinalIgnoreCase);
            var explicationCandidates = new List<PdfTextToken>();

            foreach (var rt in allRoomTokens)
            {
                bool isTable = tokens.Any(t => t != rt && AreaRegex.IsMatch(t.Text) && 
                    ((Math.Abs(t.X - rt.X) < 50 && Math.Abs(t.Y - rt.Y) < 4000) || 
                     (Math.Abs(t.Y - rt.Y) < 50 && Math.Abs(t.X - rt.X) < 4000)));

                if (isTable)
                    explicationCandidates.Add(rt);
                else
                    planCoords[rt.Text] = rt;
            }

            double minX = 999999, maxX = -999999, minY = 999999, maxY = -999999;
            foreach (var pt in planCoords.Values)
            {
                if (pt.X < minX) minX = pt.X;
                if (pt.X > maxX) maxX = pt.X;
                if (pt.Y < minY) minY = pt.Y;
                if (pt.Y > maxY) maxY = pt.Y;
            }
            if (minX > maxX) { minX = 0; maxX = 30000; minY = 0; maxY = 40000; }
            
            double padX = (maxX - minX) * 0.1; if (padX == 0) padX = 1000;
            double padY = (maxY - minY) * 0.1; if (padY == 0) padY = 1000;
            minX -= padX; maxX += padX; minY -= padY; maxY += padY;

            var rooms = new List<Room>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            explicationCandidates = explicationCandidates.OrderByDescending(t => t.Y).ThenBy(t => t.X).ToList();
            int orderIdx = 0;

            foreach (var numTok in explicationCandidates)
            {
                if (!seen.Add(numTok.Text)) continue;

                var colItems = tokens.Where(t => Math.Abs(t.X - numTok.X) <= 50 && Math.Abs(t.Y - numTok.Y) < 4000).ToList();
                var areaTok = colItems.FirstOrDefault(t => t != numTok && AreaRegex.IsMatch(t.Text));

                List<PdfTextToken> rowItems;
                if (areaTok != null)
                {
                    rowItems = colItems;
                }
                else
                {
                    rowItems = tokens.Where(t => Math.Abs(t.Y - numTok.Y) <= 50 && Math.Abs(t.X - numTok.X) < 4000).ToList();
                    areaTok = rowItems.FirstOrDefault(t => t != numTok && AreaRegex.IsMatch(t.Text));
                }

                if (areaTok == null) continue;
                double areaVal = ParseDouble(areaTok.Text.Replace(',', '.'), 0);

                var nameParts = rowItems
                    .Where(t => t != numTok && t != areaTok && t.Text.Length > 2 &&
                                !AreaRegex.IsMatch(t.Text) &&
                                !FireCatRegex.IsMatch(t.Text) &&
                                !RoomPattern.IsMatch(t.Text) &&
                                !JunkRegex.IsMatch(t.Text))
                    .OrderByDescending(t => t.Y).ThenBy(t => t.X)
                    .Select(t => t.Text)
                    .ToList();

                if (!nameParts.Any()) continue;
                string roomName = string.Join(" ", nameParts);

                var catTok = rowItems.FirstOrDefault(t => FireCatRegex.IsMatch(t.Text));
                string fireCat = catTok?.Text ?? "-";

                double boxX = 5, boxY = 5;
                string source = $"Экспликация PDF (Кат. {fireCat})";
                if (planCoords.TryGetValue(numTok.Text, out var pt))
                {
                    boxX = Math.Clamp(((pt.X - minX) / (maxX - minX)) * 100, 1, 94);
                    boxY = Math.Clamp((1 - ((pt.Y - minY) / (maxY - minY))) * 100, 1, 94);
                    source = $"Экспликация PDF + План (Кат. {fireCat})";
                }
                else
                {
                    boxX = 4 + (orderIdx % 8) * 11.5;
                    boxY = 10 + (orderIdx / 8) * 14.0;
                }
                orderIdx++;

                string normCategory = InferSpCategory(roomName, fireCat);
                double height = (roomName.ToLower().Contains("автомобил") || numTok.Text.Contains("-02")) ? 3.6 : 3.3;
                double volume = Math.Round(areaVal * height, 1);

                rooms.Add(new Room
                {
                    RoomId = Guid.NewGuid(),
                    CadId = $"EXP-{orderIdx}",
                    Number = numTok.Text,
                    RawName = roomName,
                    NormalizedType = normCategory,
                    Area = Math.Round(areaVal, 2),
                    Height = height,
                    RequiredSupplyAir = normCategory.Contains("Санузел") ? 0 : Math.Round(volume * 1.5, 0),
                    RequiredExhaustAir = normCategory.Contains("Тамбур") ? 0 : Math.Round(volume * 1.5, 0),
                    BoxX = Math.Round(boxX, 1),
                    BoxY = Math.Round(boxY, 1),
                    BoxWidth = areaVal > 100 ? 12 : 7.5,
                    BoxHeight = areaVal > 100 ? 9 : 6.5,
                    DetectionSource = source
                });
            }

            return Task.FromResult<IEnumerable<Room>>(rooms.OrderBy(r => r.Number));
        }

        private static string InferSpCategory(string name, string fireCat)
        {
            string lower = name.ToLowerInvariant();
            if (lower.Contains("автомобил") || lower.Contains("машино")) return $"Автостоянка ({fireCat})";
            if (lower.Contains("санузел") || lower.Contains("уборн") || lower.Contains("пуи")) return "Санузел";
            if (lower.Contains("венткамера") || lower.Contains("холодильн") || lower.Contains("кондиционир")) return $"ОВиК ({fireCat})";
            if (lower.Contains("электрощитов") || lower.Contains("ибп") || lower.Contains("дизель") || lower.Contains("сс") || lower.Contains("асо")) return $"ЭОМ / ДЭС ({fireCat})";
            if (lower.Contains("тамбур") || lower.Contains("лестничн") || lower.Contains("лифтов") || lower.Contains("моп")) return "МОП / Тамбур-шлюз";
            if (lower.Contains("склад") || lower.Contains("инвентар") || lower.Contains("мусор") || lower.Contains("кладов")) return $"Склад ({fireCat})";
            return $"Тех. помещение ({fireCat})";
        }

        private static string DecodeCidHex(string hex, Dictionary<int, char> cmap)
        {
            var sb = new StringBuilder();
            for (int i = 0; i + 4 <= hex.Length; i += 4)
            {
                int cid = Convert.ToInt32(hex.Substring(i, 4), 16);
                if (cmap.TryGetValue(cid, out char ch)) sb.Append(ch);
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
            while (len > 0 && (allBytes[absStart + len - 1] == '\r' || allBytes[absStart + len - 1] == '\n')) len--;

            if (!header.Contains("/FlateDecode")) return Encoding.Latin1.GetString(allBytes, absStart, len);

            try
            {
                using var ms = new MemoryStream(allBytes, absStart, len);
                using var zlib = new ZLibStream(ms, CompressionMode.Decompress);
                using var sr = new StreamReader(zlib, Encoding.Latin1);
                return sr.ReadToEnd();
            }
            catch { return string.Empty; }
        }

        private static double ParseDouble(string s, double fallback)
        {
            return double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out double v) ? v : fallback;
        }
    }
}