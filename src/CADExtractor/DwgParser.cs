using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using netDxf;
using netDxf.Entities;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.CADExtractor
{
    public class DwgParser : Domain.Interfaces.IExtractor
    {
        private readonly GeometryValidator _validator;

        public DwgParser(GeometryValidator? validator = null)
        {
            _validator = validator ?? new GeometryValidator();
        }

        public Task<IEnumerable<Room>> ExtractGeometryAsync(string filePath)
        {
            var dxf = DxfDocument.Load(filePath);
            if (dxf == null) throw new InvalidOperationException("Не удалось загрузить CAD/DXF файл.");

            var rooms = new List<Room>();

            // В netDxf.netstandard 2.4.0 коллекции доступны напрямую из DxfDocument
            var polylines = (dxf.LwPolylines ?? Enumerable.Empty<LwPolyline>())
                .Where(p => p.IsClosed)
                .ToList();

            var texts = (dxf.Texts ?? Enumerable.Empty<Text>()).ToList();

            foreach (var poly in polylines)
            {
                var vertices = poly.Vertexes.Select(v => v.Position).ToList();
                if (!_validator.IsValidRoomPolygon(vertices))
                {
                    continue;
                }

                double area = CalculatePolygonArea(vertices);

                // Поиск маркировки помещения внутри контура
                var roomLabel = texts.FirstOrDefault(t => IsPointInPolygon(t.Position, vertices));

                rooms.Add(new Room
                {
                    RoomId = Guid.NewGuid(),
                    CadId = poly.Handle ?? Guid.NewGuid().ToString("N"),
                    Number = roomLabel != null ? roomLabel.Value : "Неизвестно",
                    Area = Math.Round(area, 2),
                    Height = 3.0
                });
            }

            return Task.FromResult<IEnumerable<Room>>(rooms);
        }

        private double CalculatePolygonArea(List<Vector2> vertices)
        {
            double area = 0;
            int j = vertices.Count - 1;
            for (int i = 0; i < vertices.Count; i++)
            {
                area += (vertices[j].X + vertices[i].X) * (vertices[j].Y - vertices[i].Y);
                j = i;
            }
            return Math.Abs(area / 2.0);
        }

        private bool IsPointInPolygon(Vector3 point, List<Vector2> polygon)
        {
            bool result = false;
            int j = polygon.Count - 1;
            for (int i = 0; i < polygon.Count; i++)
            {
                if ((polygon[i].Y < point.Y && polygon[j].Y >= point.Y) || (polygon[j].Y < point.Y && polygon[i].Y >= point.Y))
                {
                    if (polygon[i].X + (point.Y - polygon[i].Y) / (polygon[j].Y - polygon[i].Y) * (polygon[j].X - polygon[i].X) < point.X)
                    {
                        result = !result;
                    }
                }
                j = i;
            }
            return result;
        }
    }
}