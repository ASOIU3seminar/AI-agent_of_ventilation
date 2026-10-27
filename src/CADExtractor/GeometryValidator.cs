using System;
using System.Collections.Generic;
using netDxf;

namespace HvacAutoCalculator.CADExtractor
{
    public class GeometryValidator
    {
        // Проверка полилинии на валидность (минимум 3 точки, площадь > 1 кв.м, чтобы отсечь мусор)
        public bool IsValidRoomPolygon(List<Vector2> vertices)
        {
            if (vertices == null || vertices.Count < 3) 
                return false;

            double area = 0;
            int j = vertices.Count - 1;
            
            for (int i = 0; i < vertices.Count; i++)
            {
                area += (vertices[j].X + vertices[i].X) * (vertices[j].Y - vertices[i].Y);
                j = i;
            }
            
            area = Math.Abs(area / 2.0);

            // Если площадь меньше 1 кв.м. — это, скорее всего, колонна, короб или артефакт чертежа, а не комната
            return area >= 1.0;
        }
    }
}