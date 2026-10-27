FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["hvac-auto-calculator.sln", "./"]
COPY ["src/Domain/Domain.csproj", "src/Domain/"]
COPY ["src/CADExtractor/CADExtractor.csproj", "src/CADExtractor/"]
COPY ["src/DataMapper/DataMapper.csproj", "src/DataMapper/"]
COPY ["src/HVACCalculator/HVACCalculator.csproj", "src/HVACCalculator/"]
COPY ["src/ExcelGenerator/ExcelGenerator.csproj", "src/ExcelGenerator/"]
RUN dotnet restore

COPY . .
RUN dotnet publish "src/HVACCalculator/HVACCalculator.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "HVACCalculator.dll"]