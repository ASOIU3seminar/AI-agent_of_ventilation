using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using netDxf;
using netDxf.Entities;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.CADExtractor
{
    public class DwgParser : HvacAutoCalculator.Domain.Interfaces.IExtractor
    {
        public Task<IEnumerable<Room>> ExtractGeometryAsync(string filePath)
        {
            var dxf = DxfDocument.Load(filePath);
            if (dxf == null) throw new Exception("Не удалось загрузить CAD файл.");

            var rooms = new List<Room>();
            
            // Фильтруем полилинии на слое "Помещения" или замкнутые
            var polylines = dxf.Entities.Polylines2D.Where(p => p.IsClosed).ToList();
            var texts = dxf.Entities.Texts.ToList();

            foreach (var poly in polylines)
            {
                double area = CalculatePolygonArea(poly.Vertexes.Select(v => v.Position).ToList());
                
                // Ищем текст, геометрически находящийся внутри полилинии
                var roomLabel = texts.FirstOrDefault(t => IsPointInPolygon(t.Position, poly.Vertexes.Select(v => v.Position).ToList()));

                rooms.Add(new Room
                {
                    RoomId = Guid.NewGuid(),
                    CadId = poly.Handle,
                    Number = roomLabel != null ? roomLabel.Value : "Неизвестно",
                    Area = Math.Round(area, 2),
                    Height = 3.0 // Базовая высота, если не переопределена в Excel
                });
            }
            return Task.FromResult<IEnumerable<Room>>(rooms);
        }

        // Формула Гаусса для вычисления площади произвольного многоугольника
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

        // Алгоритм Ray-Casting для определения, находится ли точка (текст) внутри контура
        private bool IsPointInPolygon(Vector3 point, List<Vector2> polygon)
        {
            bool result = false;
            int j = polygon.Count - 1;
            for (int i = 0; i < polygon.Count; i++)
            {
                if (polygon[i].Y < point.Y && polygon[j].Y >= point.Y || polygon[j].Y < point.Y && polygon[i].Y >= point.Y)
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