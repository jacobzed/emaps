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
                SELECT region_id as regionid, map_id as mapid, id as featureid, 'City: ' || name as name, 2
                FROM map_shp
                WHERE map_id = 12 
                AND region_id = @region

                -- get 343 ridings from the 2023 federal representation order
                UNION
                SELECT region_id as regionid, map_id as mapid, id as featureid, 'Riding: ' || name as name, 1
                FROM map_shp
                WHERE map_id = 30 
                AND region_id = @region

                ORDER BY 5, 4
            ", new { region });
        }

        /// <summary>
        /// Get features at the given location.
        /// </summary>
        public async Task<IEnumerable<MapFeature>> GetLatLngFeatures(double lat, double lng)
        {
            return await db.QueryAsync<MapFeature>(@"
                SELECT region_id as regionid, map_id as mapid, id as featureid, 'City: ' || name as name, 2
                FROM map_shp
                WHERE map_id = 12 
                AND ST_Contains(geom, ST_SetSRID(ST_MakePoint(@lng, @lat), 4326))

                -- get 343 ridings from the 2023 federal representation order
                UNION
                SELECT region_id as regionid, map_id as mapid, id as featureid, 'Riding: ' || name as name, 1
                FROM map_shp
                WHERE map_id = 30
                AND ST_Contains(geom, ST_SetSRID(ST_MakePoint(@lng, @lat), 4326))   

                ORDER BY 5, 4
            ", new { lat, lng });
        }


        /// <summary>
        /// Get a single feature from the specified map.
        /// </summary>
        /// <returns>GeoJSON</returns>
        public async Task<string> GetGeoJson(int mapId, string featureId)
        {
            return await db.QueryFirstAsync<string>(@"
                SELECT jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                            'properties', to_jsonb(shp) - 'geom' - 'map_id'
                        )
                    )
                ) AS geojson
                FROM map_shp shp
                WHERE map_id = @mapId
                AND id = @featureId
                ", new { mapId, featureId });
        }

        /// <summary>
        /// Get all features from the specified map that overlap with another map feature from the database.
        /// </summary>
        /// <returns>GeoJSON</returns>
        public async Task<string> GetGeoJsonFromIntersect(int mapId, int intersectMapId, string intersectFeatureId)
        {
            return await db.QueryFirstAsync<string>(@"
                SELECT jsonb_build_object(
                    'type', 'FeatureCollection',
                    'features', jsonb_agg(
                        jsonb_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                            'properties', to_jsonb(shp) - 'geom' - 'map_id'
                        )
                    )
                ) AS geojson
                FROM map_shp shp
                JOIN map_shp bounds
                ON ST_Area(ST_Intersection(shp.geom, bounds.geom)) / ST_Area(shp.geom) >= 0.2
                WHERE shp.map_id = @mapId
                AND bounds.map_id = @intersectMapId
                AND bounds.id = @intersectFeatureId
                ", new { mapId, intersectMapId, intersectFeatureId });
        }

        /// <summary>
        /// Get all features from the specified map that overlap with the given WKT region.
        /// </summary>
        /// <returns>GeoJSON</returns>
        public async Task<string> GetGeoJsonFromIntersect(int mapId, string intersectWKT)
        {
            intersectWKT = SanitizeWKT(intersectWKT);

            return await db.QueryFirstAsync<string>(@"
                    SELECT jsonb_build_object(
                        'type', 'FeatureCollection',
                        'features', jsonb_agg(
                            jsonb_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(shp.geom)::jsonb,
                                'properties', to_jsonb(shp) - 'geom'
                            )
                        )
                    ) AS geojson
                    FROM map_shp shp
                    JOIN (SELECT ST_GeomFromText(@intersectWKT, 4326) AS geom) AS bounds
                    ON ST_Area(ST_Intersection(shp.geom, bounds.geom)) / ST_Area(shp.geom) >= 0.2
                    WHERE shp.map_id = @mapId
                
                ", new { mapId, intersectWKT });
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

    }
}
