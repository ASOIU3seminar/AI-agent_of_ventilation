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

        private static readonly Regex RoomPattern = new(@"^(-?[0-9]{1,2}\.[0-9]{2}[а-яА-Яa-zA-Z]?|-[0-9]{2}\.[A-Za-zА-Яа-я0-9]{2}\.[0-9]{1,3}|[0-9]{1,2}\.[A-Za-z0-9]+\.[0-9]{1,3})$", RegexOptions.Compiled);
        private static readonly Regex DateRegex = new(@"^\d{2}\.\d{2}\.\d{2,4}$", RegexOptions.Compiled);
        private static readonly Regex CodeRegex = new(@"^\d+\.\d+\.\d+$", RegexOptions.Compiled);
        private static readonly Regex CompositeBasePattern = new(@"^-?[0-9]{1,2}\.[0-9]{2}$", RegexOptions.Compiled);
        private static readonly Regex CompositeSuffixPattern = new(@"^[а-яА-Яa-zA-Z]$", RegexOptions.Compiled);

        private static readonly Regex AreaRegex = new(@"^[0-9]{1,5}[\.,][0-9]{2}$", RegexOptions.Compiled);
        private static readonly Regex FireCatRegex = new(@"^(В[1-4]|Д|А|Б|Г|-)$", RegexOptions.Compiled);
        private static readonly Regex JunkRegex = new(@"^([-+]?\d+([.,]\d+)?|\d+:\d+|\d{2}\.\d{2}\.\d{2,4}|\d+\.\d+\.\d+)$", RegexOptions.Compiled);

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
                double curX = 0;
                double curY = 0;

                using var sr = new StringReader(streamText);
                string? line;
                while ((line = sr.ReadLine()) != null)
                {
                    var tfM = TfRegex.Match(line);
                    if (tfM.Success) curFont = tfM.Groups[1].Value;

                    var tmM = TmRegex.Match(line);
                    if (tmM.Success)
                    {
                        curX = ParseDouble(tmM.Groups[5].Value, curX);
                        curY = ParseDouble(tmM.Groups[6].Value, curY);
                    }

                    var hexM = HexTjRegex.Match(line);
                    if (hexM.Success)
                    {
                        string decoded = fontCmaps.TryGetValue(curFont, out var cmap)
                            ? DecodeCidHex(hexM.Groups[1].Value, cmap)
                            : string.Empty;
                        if (!string.IsNullOrWhiteSpace(decoded))
                        {
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = decoded.Trim() });
                        }
                    }
                    else
                    {
                        var litM = LiteralTjRegex.Match(line);
                        if (litM.Success && !string.IsNullOrWhiteSpace(litM.Groups[1].Value))
                        {
                            tokens.Add(new PdfTextToken { X = curX, Y = curY, Font = curFont, Text = litM.Groups[1].Value.Trim() });
                        }
                    }
                }
            }

            // Определение высоты этажа из чертежа (без вычитания плиты)
            double floorHeight = 3.6;
            var otmToken = tokens.FirstOrDefault(t => t.Text.Contains("-18,600") || t.Text.Contains("-18.600"));
            if (otmToken != null) floorHeight = 3.6;
            else if (tokens.Any(t => t.Text.Contains("-15,000") || t.Text.Contains("-15.000"))) floorHeight = 3.6;
            else if (tokens.Any(t => t.Text.Contains("-11,400") || t.Text.Contains("-11.400"))) floorHeight = 3.6;
            else if (tokens.Any(t => t.Text.Contains("-8,100") || t.Text.Contains("-8.100"))) floorHeight = 3.3;
            else if (tokens.Any(t => t.Text.Contains("-4,800") || t.Text.Contains("-4.800"))) floorHeight = 3.3;

            // Сборка составных номеров
            var compositeBases = tokens.Where(t => CompositeBasePattern.IsMatch(t.Text) && !DateRegex.IsMatch(t.Text)).ToList();
            var mergedRoomTokens = new List<PdfTextToken>();
            var usedSuffixes = new HashSet<PdfTextToken>();

            foreach (var b in compositeBases)
            {
                var suffix = tokens.FirstOrDefault(t =>
                    !usedSuffixes.Contains(t) &&
                    CompositeSuffixPattern.IsMatch(t.Text) &&
                    Math.Abs(t.Y - b.Y) <= 8 &&
                    (t.X - b.X) > 0 && (t.X - b.X) <= 60);

                if (suffix != null)
                {
                    usedSuffixes.Add(suffix);
                    mergedRoomTokens.Add(new PdfTextToken
                    {
                        X = b.X,
                        Y = b.Y,
                        Font = b.Font,
                        Text = b.Text + suffix.Text
                    });
                }
                else
                {
                    mergedRoomTokens.Add(b);
                }
            }

            var singleTokens = tokens.Where(t =>
                RoomPattern.IsMatch(t.Text) &&
                !CompositeBasePattern.IsMatch(t.Text) &&
                !DateRegex.IsMatch(t.Text) &&
                !CodeRegex.IsMatch(t.Text) &&
                !usedSuffixes.Contains(t));

            var allRoomTokens = mergedRoomTokens.Concat(singleTokens).ToList();

            var planCoords = new Dictionary<string, PdfTextToken>();
            var expCandidates = new List<PdfTextToken>();

            foreach (var rt in allRoomTokens)
            {
                bool hasNearbyArea = tokens.Any(t =>
                    t != rt &&
                    AreaRegex.IsMatch(t.Text) &&
                    ((Math.Abs(t.X - rt.X) <= 85 && Math.Abs(t.Y - rt.Y) < 4200) ||
                     (Math.Abs(t.Y - rt.Y) <= 85 && Math.Abs(t.X - rt.X) < 4200)));

                if (hasNearbyArea)
                {
                    expCandidates.Add(rt);
                }
                else if (!planCoords.ContainsKey(rt.Text))
                {
                    planCoords[rt.Text] = rt;
                }
            }

            double minX = planCoords.Values.Any() ? planCoords.Values.Min(p => p.X) : 0;
            double maxX = planCoords.Values.Any() ? planCoords.Values.Max(p => p.X) : 1000;
            double minY = planCoords.Values.Any() ? planCoords.Values.Min(p => p.Y) : 0;
            double maxY = planCoords.Values.Any() ? planCoords.Values.Max(p => p.Y) : 1000;
            if (Math.Abs(maxX - minX) < 1) maxX = minX + 1000;
            if (Math.Abs(maxY - minY) < 1) maxY = minY + 1000;

            var rooms = new List<Room>();
            var seen = new HashSet<string>();
            int orderIdx = 0;

            foreach (var numTok in expCandidates)
            {
                if (seen.Contains(numTok.Text)) continue;
                seen.Add(numTok.Text);

                var colItems = tokens.Where(t => Math.Abs(t.X - numTok.X) <= 85 && Math.Abs(t.Y - numTok.Y) < 4200).ToList();
                var areaTok = colItems.FirstOrDefault(t => t != numTok && AreaRegex.IsMatch(t.Text));

                List<PdfTextToken> rowItems;
                if (areaTok != null)
                {
                    rowItems = colItems;
                }
                else
                {
                    rowItems = tokens.Where(t => Math.Abs(t.Y - numTok.Y) <= 85 && Math.Abs(t.X - numTok.X) < 4200).ToList();
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

                double cadX = 2000 + (orderIdx % 8) * 3200;
                double cadY = 35000 - (orderIdx / 8) * 3800;
                double boxX = 4 + (orderIdx % 8) * 11.5;
                double boxY = 10 + (orderIdx / 8) * 14.0;
                string source = $"Экспликация PDF (Кат. {fireCat})";

                if (planCoords.TryGetValue(numTok.Text, out var pt))
                {
                    cadX = pt.X;
                    cadY = pt.Y;
                    boxX = Math.Clamp(((pt.X - minX) / (maxX - minX)) * 100, 2, 92);
                    boxY = Math.Clamp((1.0 - ((pt.Y - minY) / (maxY - minY))) * 100, 2, 92);
                    source = $"Экспликация PDF + План (Кат. {fireCat})";
                }
                orderIdx++;

                rooms.Add(new Room
                {
                    RoomId = Guid.NewGuid(),
                    CadId = $"EXP-{orderIdx}",
                    Number = numTok.Text,
                    RawName = roomName,
                    FireCategory = fireCat,
                    Area = Math.Round(areaVal, 2),
                    Height = floorHeight,
                    CadX = Math.Round(cadX, 1),
                    CadY = Math.Round(cadY, 1),
                    BoxX = Math.Round(boxX, 1),
                    BoxY = Math.Round(boxY, 1),
                    BoxWidth = areaVal > 100 ? 11.0 : 7.5,
                    BoxHeight = areaVal > 100 ? 8.5 : 6.0,
                    DetectionSource = source
                });
            }

            return Task.FromResult<IEnumerable<Room>>(rooms.OrderBy(r => r.Number));
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
