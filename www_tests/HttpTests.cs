/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/


using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EMapper.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;


namespace EMapperTests.Integration;

// These tests are all readonly operations and run on the live db without a mock
public class HttpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HttpTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetRegions_ReturnsOkAndResults()
    {
        var response = await _client.GetAsync("/api/region");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<Region>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
    }

    [Fact]
    public async Task GetRegionFeatures_ReturnsOkAndResults()
    {
        var region = "BC";
        var response = await _client.GetAsync($"/api/region/{region}/features");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<MapFeature>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
    }

    [Fact]
    public async Task GetRegionElectionTraits_ReturnsOkAndResults()
    {
        var region = "BC";
        var response = await _client.GetAsync($"/api/region/{region}/elections");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<ElectionTrait>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
    }

    [Fact]
    public async Task GetGeoJsonAll_ReturnsOkAndJson()
    {
        var mapId = 32; // 2023 Federal Ridings
        var response = await _client.GetAsync($"/api/map/{mapId}");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<GeoJsonResult>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Features);
    }

    [Fact]
    public async Task GetGeoJsonSingle_ReturnsOkAndJson()
    {
        var mapId = 30; // 2023 Federal Ridings
        var featureId = "59002";
        var response = await _client.GetAsync($"/api/map/{mapId}/{featureId}");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<GeoJsonResult>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Features);
    }

    [Fact]
    public async Task GetGeoJsonFromIntersect_ReturnsOkAndJson()
    {
        var mapId = 21; // 2021 Federal Polls
        var intersectMapId = 30; // 2023 Federal Ridings
        var intersectFeatureId = "59002";
        var response = await _client.GetAsync($"/api/map/{mapId}/{intersectMapId}/{intersectFeatureId}");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<GeoJsonResult>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Features);
    }

    [Fact]
    public async Task GetGeoJsonFromBounds_ReturnsOkAndJson()
    {
        var mapId = 30; // 2023 Federal Ridings
        var response = await _client.GetAsync($"/api/map/{mapId}/-123.29,49.14,-122.85,49.35/12");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<GeoJsonResult>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Features);
    }

    [Fact]
    public async Task PostElectionData_ReturnsOkAndResults()
    {
        var query = new ElectionDataQuery
        {
            ElectionId = 44,
            GeoId = new[] { "35090-11", "35104-403" }
        };

        var response = await _client.PostAsJsonAsync("/api/election/data", query);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<ElectionData>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
        Assert.True(content.Results.All(r => query.ElectionId) == r.ElectionId);
        Assert.True(content.Results.All(r => query.GeoId.Contains(r.GeoId)));
    }

    [Fact]
    public async Task GetCensusTraits_ReturnsOkAndResults()
    {
        var response = await _client.GetAsync("/api/census/trait");
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<CensusTrait>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
    }

    [Fact]
    public async Task PostCensusData_ReturnsOkAndResults()
    {
        var query = new CensusDataQuery
        {
            CensusId = 1,
            TraitId = new[] { 1, 2, 3 },
            GeoType = "DA",
            GeoId = new[] { "60010184", "60010285" }
        };

        var response = await _client.PostAsJsonAsync("/api/census/data", query);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadFromJsonAsync<CollectionResult<CensusData>>();
        Assert.NotNull(content);
        Assert.NotEmpty(content.Results);
        Assert.True(content.Results.All(r => query.TraitId.Contains(r.TraitId)));
        Assert.True(content.Results.All(r => query.GeoId.Contains(r.GeoId)));
    }
}

public class CollectionResult<T> where T : class
{
    public required T[] Results { get; set; }
}

public class GeoJsonResult
{
    public required string Type { get; set; }
    public required Feature[] Features { get; set; }

    public class Feature
    {
        public required string Type { get; set; }
        public required Dictionary<string, string> Properties { get; set; }
    }
}
