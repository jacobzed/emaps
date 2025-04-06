/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/


using System.Data;
using System.Text.Json.Serialization;
using Dapper;


namespace EMapper.Services
{
    public class Region
    {
        public required string Id { get; set; }
        public required string Name { get; set; }
    }
        
    public class ElectionTrait
    {
        public int ElectionId { get; set; }
        public required string Type { get; set; }
        public required string Name { get; set; }
        public required string Party { get; set; }
        public int MapId { get; set; }
    }

    /// <summary>
    /// This data structure is inefficient for transfering large amounts of data to the browser.
    /// As a lazy optimization, we will shorten the key names to save an easy 40%.
    /// </summary>
    public class ElectionData
    {
        [JsonPropertyName("e")]
        public int ElectionId { get; set; }
        [JsonPropertyName("g")]
        public required string GeoId { get; set; }
        [JsonPropertyName("p")]
        public required string Party { get; set; }
        [JsonPropertyName("c")]
        public required string Candidate { get; set; }
        [JsonPropertyName("v")]
        public int Votes { get; set; }
        [JsonPropertyName("vp")]
        public float Pct { get; set; }
    };

    public class ElectionDataQuery
    {
        public required int ElectionId { get; set; }
        public required string[] GeoId { get; set; }
    }

    public class CensusTrait
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public string? Category { get; set; }
        public string? Description { get; set; }
        public int MapId { get; set; }
        public bool IsRate { get; set; }
    }

    /// <summary>
    /// This data structure is inefficient for transfering large amounts of data to the browser.
    /// As a lazy optimization, we will shorten the key names to save an easy 40%.
    /// </summary>
    public class CensusData
    {
        [JsonPropertyName("t")]
        public int TraitId { get; set; }
        //[JsonPropertyName("gt")]
        //public required string GeoType { get; set; }
        [JsonPropertyName("g")]
        public required string GeoId { get; set; }
        [JsonPropertyName("v")]
        public decimal Value { get; set; }
        //[JsonPropertyName("r")]
        //public decimal Rate { get; set; }
    };

    public class CensusDataQuery
    {
        public required int CensusId { get; set; }
        public required int[] TraitId { get; set; }
        public required string GeoType { get; set; }
        public required string[] GeoId { get; set; }
    }

    public class DataService
    {
        private readonly IDbConnection db;

        public DataService(IDbConnection db)
        {
            this.db = db;
        }

        /// <summary>
        /// Get all provinces/territories/states.
        /// </summary>
        public async Task<IEnumerable<Region>> GetRegions()
        {
            return await db.QueryAsync<Region>(@"
                SELECT *
                FROM region
                WHERE type = 'Province'
                ORDER BY name
            ");
        }

        public async Task<IEnumerable<ElectionTrait>> GetRegionElectionTraits(string region)
        {
            return await db.QueryAsync<ElectionTrait>(@"
                SELECT id as electionid, 
                    date_part('year', date)::text || case when type = 'F' then ' Fed. ' else ' Prov. ' end || party || ' %' as name,
                    party,
                    '%' as type, 
                    map_id as mapId
                FROM election, unnest(parties) as party
                WHERE is_archived = false
                AND map_id IS NOT NULL
                AND (region_id = @region OR region_id IS NULL)

                ORDER BY party, 1, 2
            ", new { region });
        }

        public async Task<IEnumerable<ElectionData>> GetElectionData(ElectionDataQuery query)
        {
            if (query.GeoId.Length == 0)
                throw new ArgumentException("At least one geoId must be provided");
            // cities may have 1000+ geoIds e.g. Hamilton, ON
            if (query.GeoId.Length > 2000)
                throw new ArgumentException("Too many geoIds");

            return await db.QueryAsync<ElectionData>(@"
                SELECT election_id as electionId, ed_id || '-' || va_id as geoId, party, candidate, votes, pct
                FROM election_data
                WHERE election_id = @electionId
                AND ed_id || '-' || va_id = ANY(@geoId)
                ORDER BY 2, 3
            ", new { query.ElectionId, query.GeoId });

            /*
            var results = await db.QueryAsync<ElectionData, ElectionData.Result, ElectionData>(@"
                SELECT election_id as electionId, ed_id || '-' || va_id as geoId, party, candidate, votes, pct
                FROM election_data
                WHERE election_id = @electionId
                AND ed_id || '-' || va_id = ANY(@geoId)
                ORDER BY 2
            ", (election, result) =>
            {
                election.Results.Add(result);
                return election;
            },
            new { query.ElectionId, query.GeoId },
            splitOn: "party"
            );

            // Group results by electionId and geoId  
            results = results.GroupBy(e => e.GeoId)
                .Select(g =>
                {
                    var election = g.First();
                    election.Results = g.SelectMany(e => e.Results).ToList();
                    return election;
                });
            
            return results;
            */
        }

        public async Task<IEnumerable<CensusTrait>> GetCensusTraits(int censusId)
        {
            return await db.QueryAsync<CensusTrait>(@"
                SELECT *, is_rate as isRate, 10 as mapId
                FROM census_trait
                WHERE census_id = @censusId 
                AND is_hidden = false
                ORDER BY id
            ", new { censusId });
        }

        public async Task<IEnumerable<CensusData>> GetCensusData(CensusDataQuery query)
        {
            if (query.GeoId.Length == 0)
                throw new ArgumentException("At least one geoId must be provided");
            if (query.GeoId.Length > 2000)
                throw new ArgumentException("Too many geoIds");

            if (query.TraitId.Length == 0)
                throw new ArgumentException("At least one traitId must be provided");
            if (query.TraitId.Length > 50)
                throw new ArgumentException("Too many traitIds");

            return await db.QueryAsync<CensusData>(@"
                SELECT trait_id AS TraitId, 
                    geo_type AS GeoType, 
                    geo_id AS GeoId, 
                    case when is_rate then rate else value end AS Value
                FROM census_data
                INNER JOIN census_trait ON census_data.census_id = census_trait.census_id AND census_data.trait_id = census_trait.id
                WHERE census_data.census_id = @censusId AND trait_id = ANY(@traitId) AND geo_type = @geoType AND geo_id = ANY(@geoId)
            ", new { query.CensusId, query.TraitId, query.GeoType, query.GeoId });
        }

    }
}
