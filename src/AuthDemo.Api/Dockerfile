FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/AuthDemo.Api/AuthDemo.Api.csproj src/AuthDemo.Api/
RUN dotnet restore src/AuthDemo.Api/AuthDemo.Api.csproj

COPY src/AuthDemo.Api/ src/AuthDemo.Api/
RUN dotnet publish src/AuthDemo.Api/AuthDemo.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

ENTRYPOINT ["dotnet", "AuthDemo.Api.dll"]
