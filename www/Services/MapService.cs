/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/


using System.Data;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dapper;
using EMapper.Services;


namespace EMapper.Services
{
    public class MapFeature
    {
        public required string RegionId { get; set; }
        public int MapId { get; set; }
        public required string FeatureId { get; set; }
        public required string Name { get; set; }
    }

    public class GeoJson
    {
        /// <summary>
        /// Set of IDs for the features in the GeoJSON object.
        /// This is mostly for cache invalidation.
        /// </summary>
        public required string[] FeatureIds { get; set; }

        /// <summary>
        /// The actual GeoJSON object.
        /// This is kept as a string to avoid the overhead of deserializing it into a C# object since we don't need to
        /// do any further processing on it before returning it to the client.
        /// </summary>
        public required string Content { get; set; }
    }


    public class MapService
    {
        private readonly IDbConnection db;

        public MapService(IDbConnection db)
        {
            this.db = db;
        }

        /// <summary>
        /// Get administrative and political boundaries in the specified region. 
        /// e.g. cities, ridings.
        /// </summary>
        public async Task<IEnumerable<MapFeature>> GetRegionFeatures(string region)
        {
            return await db.QueryAsync<MapFeature>(@"
                SELECT region_id as regionid, map_id as mapid, id as featureid, 'City: ' || name as name, 3
                FROM map_shp
                WHERE map_id = 12 
                AND region_id = @region

                -- get 343 ridings from the 2023 federal representation order
                UNION
                SELECT region_id as regionid, map_id as mapid, id as featureid, '2025 Riding: ' || name as name, 1
                FROM map_shp
                WHERE map_id = 30 
                AND region_id = @region

                -- get 338 ridings from the 2013 federal representation order
                UNION
                SELECT region_id as regionid, map_id as mapid, id as featureid, '2021 Riding: ' || name as name, 2
                FROM map_shp
                WHERE map_id = 20 
                AND region_id = @region

                ORDER BY 5, 4
            ", new { region });
        }

        /// <summary>
        /// Get all features from the specified map.
        /// </summary>
        public async Task<GeoJson> GetGeoJson(int mapId)
        {
            return await db.QueryFirstAsync<GeoJson>(@"
                SELECT jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                            'properties', to_jsonb(shp) - 'geom' - 'map_id'
                        )
                    )
                ) AS content
                FROM map_shp shp
                WHERE map_id = @mapId
                ", new { mapId });
        }

        /// <summary>
        /// Get a single feature from the specified map.
        /// </summary>
        public async Task<GeoJson> GetGeoJson(int mapId, string featureId)
        {
            return await db.QueryFirstAsync<GeoJson>(@"
                SELECT jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                            'properties', to_jsonb(shp) - 'geom' - 'map_id'
                        )
                    )
                ) AS content
                FROM map_shp shp
                WHERE map_id = @mapId
                AND id = @featureId
                ", new { mapId, featureId });
        }

        /// <summary>
        /// Get all features from the specified map that overlap with another map feature from the database.
        /// </summary>
        public async Task<GeoJson> GetGeoJsonFromIntersect(int mapId, int intersectMapId, string intersectFeatureId)
        {
            return await db.QueryFirstAsync<GeoJson>(@"
                SELECT jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                            'properties', to_jsonb(shp) - 'geom' - 'map_id'
                        )
                    )
                ) AS content
                FROM map_shp shp
                JOIN map_shp bounds
                ON ST_Area(ST_Intersection(shp.geom, bounds.geom)) / ST_Area(shp.geom) >= 0.2
                WHERE shp.map_id = @mapId
                AND bounds.map_id = @intersectMapId
                AND bounds.id = @intersectFeatureId
                ", new { mapId, intersectMapId, intersectFeatureId });
        }

        /// <summary>
        /// Get all features from the specified map that overlap with the given bounding box.
        /// </summary>
        public async Task<GeoJson> GetGeoJsonFromBounds(int mapId, decimal west, decimal south, decimal east, decimal north)
        {
            return await db.QueryFirstAsync<GeoJson>(@"
                WITH x AS (
                    SELECT id, name, shp.geom
                    FROM map_shp shp
                    JOIN (SELECT ST_MakeEnvelope(@west, @south, @east, @north, 4326) AS geom) AS bounds
                    ON ST_Intersects(shp.geom, bounds.geom) = True
	                WHERE map_id = @mapId
                )
                SELECT array_agg(id) AS featureids,
                    jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(geom)::jsonb,
                            'properties', to_jsonb(x) - 'geom'
                        )
                    )
                ) AS content
                FROM x
                
                ", new { mapId, north, south, east, west });
        }

        /// <summary>
        /// Get all features from the specified map that overlap with the given bounding box.
        /// </summary>
        /// <returns>GeoJSON</returns>
        public async Task<GeoJson> GetGeoJsonFromBoundsWithSimplify(int mapId, decimal west, decimal south, decimal east, decimal north, int zoom)
        {
            var tolerance = GetSimplifyTolerance(zoom);

            return await db.QueryFirstAsync<GeoJson>(@"
                WITH x AS (
                    SELECT id, name, shp.geom
                    FROM map_shp shp
                    JOIN (SELECT ST_MakeEnvelope(@west, @south, @east, @north, 4326) AS geom) AS bounds
                    ON ST_Intersects(shp.geom, bounds.geom) = True
	                WHERE map_id = @mapId
                ), 
                y AS (
                    SELECT id, name, ST_CoverageSimplify(geom, @tolerance) OVER () AS simplified_geom
                    FROM x
                )
                SELECT array_agg(id) AS featureids,
                    jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(simplified_geom)::jsonb,
                            'properties', to_jsonb(y) - 'simplified_geom'
                        )
                    )
                ) AS content
                FROM y
                
                ", new { mapId, north, south, east, west, tolerance });
        }

        /// <summary>
        /// Remove invalid characters from WKT string.
        /// The returned string may not be valid WKT and may have inbalanced parentheses to 
        /// exploit short circuit predicate evaluation.
        /// </summary>
        private string SanitizeWKT(string wkt)
        {
            return Regex.Replace(wkt, "[^A-Za-z0-9,() ]", "");
        }

        /// <summary>
        /// Calculate best simplify tolerance so that we don't fetch too much detail at low zoom levels.
        /// </summary>
        private decimal GetSimplifyTolerance(int zoom)
        {
            switch (zoom)
            {
                case >= 15:
                    return 0.0003m;
                case 14:
                    return 0.0004m;
                case 13:
                    return 0.0005m;
                case 12:
                    return 0.001m; 
                case 11:
                    return 0.002m;
                case <= 7:
                    return 0.1m;
                default:
                    return 0.01m;
            }
        }

    }
}
