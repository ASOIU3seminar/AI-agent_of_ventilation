using System.Collections.Generic;
using System.Threading.Tasks;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.Domain.Interfaces
{
    public interface IExtractor
    {
        Task<IEnumerable<Room>> ExtractGeometryAsync(string filePath);
    }
}