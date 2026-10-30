using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using HvacAutoCalculator.CADExtractor;
using HvacAutoCalculator.DataMapper;
using HvacAutoCalculator.HVACCalculator;
using HvacAutoCalculator.HVACCalculator.Agents;
using HvacAutoCalculator.ExcelGenerator;
using System.Net.Http;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Services.AddControllers();

builder.Services.AddScoped<PdfFloorPlanParser>();
builder.Services.AddScoped<DwgParser>();
builder.Services.AddScoped<ExcelInputReader>();
builder.Services.AddScoped<LlmSemanticMapper>();
builder.Services.AddScoped<RoomMergeService>();
builder.Services.AddScoped<CalculationAgent>();
builder.Services.AddScoped<BalanceResolver>();
builder.Services.AddScoped<AirExchangeEngine>();
builder.Services.AddScoped<HovsReportBuilder>();
builder.Services.AddScoped<HttpClient>();

var app = builder.Build();

app.UseCors("AllowAll");
app.MapControllers();

app.Run("http://0.0.0.0:80");
