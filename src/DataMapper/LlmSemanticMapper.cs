using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace HvacAutoCalculator.DataMapper
{
    public class LlmSemanticMapper
    {
        private readonly HttpClient _httpClient;

        public LlmSemanticMapper(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string> NormalizeRoomTypeAsync(string rawName)
        {
            var requestPayload = new 
            { 
                model = "deepseek-coder", // или другая развернутая модель
                prompt = $"Сопоставь название помещения '{rawName}' с категорией из СП 60.13330. Верни только название категории.",
                temperature = 0.1
            };

            var response = await _httpClient.PostAsJsonAsync("http://llm-service:11434/api/generate", requestPayload);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<LlmResponse>();
            return result?.Response?.Trim() ?? "Неизвестно";
        }
        
        private class LlmResponse { public string Response { get; set; } }
    }
}