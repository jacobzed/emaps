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

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// This isn't a public API so CORS is only needed when running the npm/vue site separately during dev
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowAll");
}

app.MapRazorPages();

// Global error handling middleware (declared after MapRazorPages to catch API erors only)
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


/*
// Use middleware to add a cache control header to all API responses
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.GetTypedHeaders().CacheControl = new CacheControlHeaderValue
        {
            Public = true,
            MaxAge = TimeSpan.FromMinutes(60)
        };
    }

    await next();
});
*/



/*
For strict request optimization we could consolidate:
/region and /census/traits - they are both loaded on page init
/region/{region}/features and /region/{region}/elections - they are both loaded on region change

*/

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

app.MapGet("/api/map/{mapId}/{featureId}", async ([FromServices] MapService mapService, int mapId, string featureId) =>
{
    var result = await mapService.GetGeoJson(mapId, featureId);
    return Results.Text(result, "application/json");
});

app.MapGet("/api/map/{mapId}/{intersectMapId}/{intersectFeatureId}", async ([FromServices] MapService mapService, int mapId, int intersectMapId, string intersectFeatureId) =>
{
    var result = await mapService.GetGeoJsonFromIntersect(mapId, intersectMapId, intersectFeatureId);
    return Results.Text(result, "application/json");
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
    int[] suggested = [ 1, 9, 13, 24, 42, 60, 66, 396, 397, 686, 690, 1685, 1686, 1415 ];
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
