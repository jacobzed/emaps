/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/

import type { ElectionTrait, ElectionData, CensusTrait, CensusData } from "./api";
import { getElectionData, getCensusData, getCensusTraits } from "./api";
import { getPartyColor, getColorScheme } from "./colors";
import type { MapLayer } from "./MapHelper";

export type ElectionTooltip = {
    type: 'election';
    title: string;
    results: { party: string, pct: number, color: string }[];
}

export type CensusTooltip = {
    type: 'census';
    title: string;
    results: { id: number, name: string, value: string }[];
}

export type Legend = {
    //sum: number;
    //median: number;
    bins: { desc: string, color: string }[];
}

// let loadingCallback = (loading: boolean): void => { };
// export function onLoading(callback: (loading: boolean) => void) {
//     loadingCallback = callback;
// }

export type Tooltip = ElectionTooltip | CensusTooltip;

/** A cache of election data.
 * Key = electionId-geoId
 */
const electionData = new Map<string, ElectionData[]>();

/** A cache of census data.
 * Key = geoId
*/
const censusData = new Map<string, CensusData[]>();

/** A cache of census traits.
 * Key = traitId
 */
const censusTraits = new Map<number, CensusTrait>();

/** Load election data and update the map layer.
 * Although we request a single trait (e.g. 2021 Fed Election, Green Party), all the other traits from the same
 * election are also loaded. The requested trait is used for styling map features.
  */
export async function loadElectionData(layer: MapLayer, trait: ElectionTrait): Promise<Legend> {

    // Some data may already be loaded, so we only request missing data.
    const missing = [];
    const geoIds = layer.ids;
    for (const g of geoIds) {
        const key = trait.electionId + '-' + g;
        if (!electionData.has(key)) {
            missing.push(g);
        }
    }

    // Load data for features that don't have data yet
    if (missing.length > 0) {
        const data = await getElectionData(trait.electionId, missing);

        // Save a placeholder to prevent further load attempts if no data is available
        // To avoid a race condition we must do this after the await call.
        for (const g of missing) {
            const key = trait.electionId + '-' + g;
            if (!electionData.has(key)) {
                electionData.set(key, []);
            }
        }

        data.forEach(row => {
            const key = trait.electionId + '-' + row.g;
            const group = electionData.get(key) ?? [];
            const existing = group.find(r => r.p === row.p);
            if (!existing) {
                group.push(row);
            }
            electionData.set(key, group);
        });
    }

    /*
    // Collect all the values for the requested trait and group them in quartiles
    const values = [];
    for (const group of electionData.values()) {
        const row = group.find(r => r.p == trait.party && geoIds.includes(r.g));
        if (row) {
            values.push(row.vp);
        }
    }
    values.sort((a, b) => b - a);
    */

    //const bins = getQuantiles(values, 4);
    const bins = [0.35, 0.25, 0.15, 0]; // fixed values are better for absolute comparisons like margin of victory
    const colors = getColorScheme(trait.party);
    const legend = getLegend([100], [35, 25, 15, 0], colors, true);

    // Create a callback that map.refreshLayer will use for styling features
    layer.getStyle = (feature, props) => {
        const key = trait.electionId + '-' + props.id;
        const row = electionData.get(key)?.find(r => r.p === trait.party);
        if (row) {
            const i = bins.findIndex(q => row.vp >= q);
            const color = colors[i];
            return { fillColor: color, fillOpacity: 0.7, strokeColor: color };

        }
        else {
            console.log('missing data for', key, trait.party);
        }
        //return { fillColor: row ? `hsl(240, 100%, ${row.pct * 100}%)` : '#ccc' };
        return { fillColor: '#eee', fillOpacity: 0.4, strokeColor: '#eee' };
    }

    return legend;
}


/** Load census data and update the map layer.
 * We request a single trait to use for styling map features along with a set of optional traits that may be
 * useful for displaying additional information in tooltips.
 */
export async function loadCensusData(layer: MapLayer, trait: CensusTrait, traits: CensusTrait[]): Promise<Legend> {
    // The trait cache is used as a lookup table for trait names and is needed for tooltip formatting.
    await loadCensusTraits();

    // Ensure the requested trait is included in the list of traits to load
    if (!traits.includes(trait)) {
        traits.push(trait);
    }

    // Some data may already be loaded, so we only request missing data.
    // Important: this only checks for geoId existence, not for traitId. We will need to wipe the cache
    // if the displayed traits change -- which is kind of a leaky abstraction but it's faster than
    // checking if both geoId + traitId exist.
    const missing = [];
    const geoIds = layer.ids;
    for (const g of geoIds) {
        const key = g;
        if (!censusData.has(key)) {
            missing.push(g);
        }
    }

    // Load data for features that don't have data yet
    if (missing.length > 0) {
        const data = await getCensusData(traits.map(t => t.id), missing);

        // Save a placeholder to prevent further load attempts if no data is available
        // To avoid a race condition we must do this after the await call.
        for (const g of missing) {
            const key = g;
            if (!censusData.has(key)) {
                censusData.set(key, []);
            }
        }

        data.forEach(row => {
            const key = row.g;
            const group = censusData.get(key) ?? [];
            const existing = group.find(r => r.t === row.t);
            if (!existing) {
                group.push(row);
            }
            censusData.set(key, group);
        });
    }

    // Collect all the values for the requested trait and group them in quartiles
    const values = [];
    for (const group of censusData.values()) {
        const row = group.find(r => r.t == trait.id && geoIds.includes(r.g));
        if (row) {
            values.push(row.v);
        }
    }
    const bins = getQuantiles(values, 4);
    const colors = ['#88419d', '#8c96c6', '#b3cde3', '#edf8fb'];
    const legend = getLegend(values, bins, colors, trait.isRate);

    // Create a callback that map.refreshLayer will use for styling features
    layer.getStyle = (feature, props) => {
        const row = censusData.get(props.id)?.find(r => r.t == trait.id);
        if (row) {
            const i = bins.findIndex(q => row.v >= q);
            const color = colors[i];
            return { fillColor: color, fillOpacity: 0.7, strokeColor: color };
        }
        //return { fillColor: row ? `hsl(240, 100%, ${row.pct * 100}%)` : '#ccc' };
        return { fillColor: '#eee', fillOpacity: 0.4, strokeColor: '#eee' };
    }

    return legend;
}

/** Purge the census data cache. Use after a new set of census traits is selected. */
export function purgeCensusData() {
    censusData.clear();
}

/** Load census traits and save them to the cache. */
export async function loadCensusTraits(): Promise<void> {
    // Census traits are loaded all at once
    if (censusTraits.size > 0)
        return;

    const traits = await getCensusTraits();
    for (const trait of traits) {
        censusTraits.set(trait.id, { ...trait });
    }
}

/** Callback to retreive tooltip data when mouse hovers over a map feature. */
export function getTooltip(props: any, trait: CensusTrait | ElectionTrait): Tooltip | null {

    if (trait.type == 'election') {
        const group = electionData.get(trait.electionId + '-' + props.id);
        if (group) {
            return {
                type: 'election',
                title: props.id,
                results: group.map(r => ({ party: r.p, pct: r.vp, color: getPartyColor(r.p) }))
            };
        }
        return { type: 'election', title: props.id, results: [] };
    }

    if (trait.type == 'census') {
        const group = censusData.get(props.id);
        if (group) {
            return {
                type: 'census',
                title: props.id,
                results: group.map(r => {
                    const trait = censusTraits.get(r.t)!;
                    return {
                        id: r.t,
                        name: trait.category ? trait.category + ': ' + trait.name : trait.name,
                        value: trait.isRate ? r.v.toFixed(1) + '%' : r.v.toFixed(0),
                    }
                })
            };
        }
        return { type: 'census', title: props.id, results: [] };
    }

    //return { type: 'error', message: 'No data found' };
    return null;
}

/** Get the quantiles for a list of values divided into n equal parts.
 * Returns the values each quantile ends at sorted from best to worst.
 */
function getQuantiles(values: number[], n: number): number[] {
    values.sort((a, b) => b - a);
    const step = values.length / n;
    const quantiles = [];
    for (let i = 0; i < n - 1; i++) {
        quantiles.push(values[Math.round((i + 1) * step)]);
    }
    quantiles.push(values[values.length - 1]);
    // Sometimes the data may be mostly zeros except for a few outliers
    // Make sure the outliers aren't grouped with the zero values in the first bin
    if (quantiles[0] === 0) {
        quantiles[0] = 0.1;
    }
    return quantiles;
}

/** Generate a legend to explain each color code. */
function getLegend(values: number[], bins: number[], colors: string[], pct: boolean): Legend {
    const info: Legend = { bins: [] };
    let last = 0;
    for (let i = 0; i < bins.length; i++) {
        const a = i === 0 ? values[0] : bins[i-1] - (pct ? 0.1 : 1);
        const b = bins[i];
        const desc = pct ? `${a.toFixed(1)}% - ${b.toFixed(1)}%` : `${a} - ${b}`;
        // Don't show empty bins (when data isn't distributed enough to be split into bins)
        if (last !== b) {
            info.bins.push({ desc, color: colors[i] });
        }
        last = b;
    }
    return info;
}


