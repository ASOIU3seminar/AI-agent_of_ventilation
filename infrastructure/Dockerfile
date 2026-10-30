FROM bb63eea78d43
WORKDIR /src

RUN printf '<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <packageSources>\n    <clear />\n    <add key="offline" value="/root/.nuget/packages" />\n  </packageSources>\n</configuration>\n' > /src/NuGet.Config

COPY src/ ./src/
RUN dotnet publish "src/HVACCalculator/HVACCalculator.csproj" -c Release -o /app/publish --configfile /src/NuGet.Config

WORKDIR /app/publish
EXPOSE 80
ENTRYPOINT ["dotnet", "HVACCalculator.dll"]