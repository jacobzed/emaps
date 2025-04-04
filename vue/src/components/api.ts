/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/

const api = import.meta.env.VITE_API_URL;

export type CensusTrait = {
    type: 'census';
    id: number;
    name: string;
    category: string;
    description: string;
    active: boolean;
    mapId: number;
    isRate: boolean;
}

/*
export type CensusData = {
    traitId: number;
    geoId: string;
    value: number;
    rate: number;
}
*/

export type CensusData = {
    t: number;
    g: string;
    v: number;
    //r: number;
}

export type ElectionTrait = {
    type: 'election';
    electionId: number;
    name: string;
    party: string;
    active: boolean;
    mapId: number;
}

/*
export type ElectionData = {
    electionId: number;
    geoId: string;
    party: string;
    candidate: string;
    votes: number;
    pct: number;
}
*/

export type ElectionData = {
    e: number;
    g: string;
    p: string;
    c: string;
    v: number;
    vp: number;
}

export type Feature = {
    mapId: number;
    featureId: number;
    name: string;
}

export type Region = {
    id: string;
    name: string;
}

export async function getRegions() : Promise<Region[]> {
//     const response = await fetch(api + '/api/region');
//     const data = await response.json();
//     return data.results;

    // Used saved response to avoid extra request during initial load.
    const regions: Region[] = [
        { "id": "BC", "name": "British Columbia" },
        { "id": "AB", "name": "Alberta" },
        { "id": "SK", "name": "Saskatchewan" },
        { "id": "MB", "name": "Manitoba" },
        { "id": "ON", "name": "Ontario" },
        { "id": "QC", "name": "Quebec" },
        { "id": "NB", "name": "New Brunswick" },
        { "id": "NS", "name": "Nova Scotia" },
        { "id": "PE", "name": "Prince Edward Island" },
        { "id": "NL", "name": "Newfoundland and Labrador" },
        //{ "id": "NT", "name": "Northwest Territories" },
        //{ "id": "YT", "name": "Yukon" },
        //{ "id": "NU", "name": "Nunavut" },
    ];

    return regions;
}

export async function getBoundaries(regionId: string) : Promise<Feature[]> {
    const response = await fetch(api + '/api/region/' + regionId + '/features');
    const data = await response.json();
    return data.results;
}

export async function getElectionTraits(regionId: string) : Promise<ElectionTrait[]> {
    const response = await fetch(api + '/api/region/' + regionId + '/elections');
    const data = await response.json();
    return data.results
        .map((trait: any) => ({
            ...trait,
            type: 'election',
            active: trait.electionId == 44,
        }))
}

/**
 * Get GeoJSON feature.
 * e.g. get a riding boundary.
 */
export async function getFeature(mapId: number, featureId: number) : Promise<any> {
    const response = await fetch(api + '/api/map/' + mapId + '/' + featureId);
    const data = await response.json();
    return data;
}

/**
 * Get GeoJSON features that intersect with another map feature.
 * e.g. get census tracts that intersect with a riding boundary.
 */
export async function getIntersectingFeatures(mapId: number, intersectMapId: number, intersectFeatureId: number) : Promise<any> {
    const response = await fetch(api + '/api/map/' + mapId + '/' + intersectMapId + '/' + intersectFeatureId);
    const data = await response.json();
    return data;
}

export async function getElectionData(electionId: number, geoId: string[]) : Promise<ElectionData[]> {
    const response = await fetch(api + '/api/election/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            electionId: electionId,
            geoId: geoId
        })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message);
    }
    return data.results;
}

export async function getCensusTraits() : Promise<CensusTrait[]> {
    const response = await fetch(api + '/api/census/trait');
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message);
    }
    return data.results
        .map((trait: any) => ({
            ...trait,
            type: 'census',
            active: data.suggested.includes(trait.id),
        }));
}

export async function getCensusData(traitId: number[], geoId: string[]) : Promise<CensusData[]> {
    const response = await fetch(api + '/api/census/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            censusId: 1,
            traitId: traitId,
            geoId: geoId,
            geoType: 'DA',
        })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message);
    }
    return data.results;
}