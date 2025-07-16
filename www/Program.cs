/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/


using System.Data;
using System.Data.SqlClient;
using System.Text.Json;
using System.Net;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Npgsql;
using EMapper.Services;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IDbConnection>((sp) =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<MapService>();
builder.Services.AddScoped<DataService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

builder.Services.AddRazorPages();
var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    //app.UseHsts();
}

//app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// This isn't a public API so CORS is only needed when running the npm/vue site separately during dev
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowAll");
}

app.MapRazorPages();

// Global error handling middleware (declared after MapRazorPages to catch API errors only)
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
        context.Response.ContentType = "application/json";

        var handler = context.Features.Get<IExceptionHandlerPathFeature>();
        if (handler != null)
        {
            Console.Error.WriteLine(handler.Error);

            var error = new
            {
                message = handler.Error.Message,
            };

            await context.Response.WriteAsJsonAsync(error);
        }
    });
});


// Use middleware to add a cache control header to all API responses
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") && context.Response.StatusCode == 200)
    {
        context.Response.GetTypedHeaders().CacheControl = new CacheControlHeaderValue
        {
            Public = true,
            MaxAge = TimeSpan.FromMinutes(60)
        };
    }

    await next();
});




app.MapGet("/api/region", async ([FromServices] DataService dataService) =>
{
    var results = await dataService.GetRegions();
    return Results.Json(new { results });
});

app.MapGet("/api/region/{region}/features", async ([FromServices] MapService mapService, string region) =>
{
    var results = await mapService.GetRegionFeatures(region);
    return Results.Json(new { results });
});

app.MapGet("/api/region/{region}/elections", async ([FromServices] DataService dataService, string region) =>
{
    var results = await dataService.GetRegionElectionTraits(region);
    return Results.Json(new { results });
});

app.MapGet("/api/map/{mapId}", async ([FromServices] MapService mapService, int mapId) =>
{
    var result = await mapService.GetGeoJson(mapId);
    return Results.Text(result.Content, "application/json");
});

app.MapGet("/api/map/{mapId}/{featureId}", async ([FromServices] MapService mapService, int mapId, string featureId) =>
{
    var result = await mapService.GetGeoJson(mapId, featureId);
    return Results.Text(result.Content, "application/json");
});

app.MapGet("/api/map/{mapId}/{intersectMapId}/{intersectFeatureId}", async ([FromServices] MapService mapService, int mapId, int intersectMapId, string intersectFeatureId) =>
{
    var result = await mapService.GetGeoJsonFromIntersect(mapId, intersectMapId, intersectFeatureId);    
    return Results.Text(result.Content, "application/json");
});

app.MapGet("/api/map/{mapId}/{west},{south},{east},{north}/{zoom}", async ([FromServices] MapService mapService, int mapId, decimal north, decimal south, decimal east, decimal west, int zoom) =>
{
    if (mapId == 30)
    {
        // Federal ridings have been simplified to scale for 31=city, 32=province, 33=country
        mapId = 31; 
        if (zoom <= 9)
            mapId = 32;
    }
    var result = await mapService.GetGeoJsonFromBounds(mapId, west, south, east, north);
    return Results.Text(result.Content, "application/json");
});

app.MapPost("/api/election/data", async ([FromServices] DataService dataService, ElectionDataQuery query) =>
{
    var results = await dataService.GetElectionData(query);
    return Results.Json(new { results });
});

app.MapGet("/api/census/trait", async ([FromServices] DataService dataService) =>
{
    // To simplify the first iteration of the UI, I'm going to hardcode the censusId
    var censusId = 1;
    var results = await dataService.GetCensusTraits(censusId);
    int[] suggested = [ 1, 9, 13, 24, 42, 60, 66, 1685, 1686, 113, 243 ];
    return Results.Json(new { results, suggested });
});

app.MapPost("/api/census/data", async ([FromServices] DataService dataService, CensusDataQuery query) =>
{
    // To simplify the first iteration of the UI, I'm going to hardcode the censusId and "DA" geoType
    query.CensusId = 1;
    query.GeoType = "DA";
    var results = await dataService.GetCensusData(query);
    return Results.Json(new { results });
});

app.Run();

// Make sure the Program class is public so it can be accessed by the test project
public partial class Program { }