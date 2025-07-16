/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

Typical use would look like this:

1. User selects a region (province, territory, or state). This is used to limit the UI
options by only showing relevant boundaries and data for that region.

2. User selects a city, electoral district, or other administrative boundary with the region.

3. User selects a census or electoral data trait to display on the map.
Each trait has an associated map ID, which is used to load geographic features for that trait.
Those features are then color coded based on the associated data.
e.g. census data will reference census DA maps
e.g. electoral data will reference voting area (poll) maps

*/

<script setup lang="ts">
import { ref, onMounted, onErrorCaptured } from "vue";
import type { Region, Feature, CensusTrait, ElectionTrait } from "./components/api";
import { getRegions, getCensusTraits, getElectionTraits, getBoundaries } from "./components/api";
import { purgeCensusData } from "./components/data";
import Map from "./components/Map.vue";
import { showError } from './components/toast';

const dialog = ref<'region' | 'boundary' | 'trait' | 'about' | ''>('');
const loading = ref(false);
const regions = ref<Region[]>([]);
const region = ref<Region | null>(null);
const boundaries = ref<Feature[]>([]);
const boundariesCategory = ref<string[]>([]);
const boundary = ref<Feature | null>(null);
const censusTraits = ref<CensusTrait[]>([]);
const electionTraits = ref<ElectionTrait[]>([]);
const dual = ref(false);

const map1 = ref<InstanceType<typeof Map> | null>(null);
const map2 = ref<InstanceType<typeof Map> | null>(null);

onMounted(async () => {
    try {
        // Census traits don't vary by region so they can be loaded immediately
        censusTraits.value = await getCensusTraits();
        loadVisibleCensusTraits();
        regions.value = await getRegions();

        if (window.location.hash) {
            popState();
        }
        else {
            // const last = localStorage.getItem('region') || 'BC';
            // const targetRegion = regions.value.find(r => r.id == last);
            // if (targetRegion) {
            //     selectRegion(targetRegion);
            // }
            selectRegion(regions.value[0]);
            showAllRidings();
        }
        window.addEventListener('popstate', popState);

    } catch (e) {
        showError(e);
    }
});

onErrorCaptured((err: unknown) => {
    loading.value = false;
    showError(err);
    return false;
});

async function selectRegion(selectedRegion: Region, clicked: boolean = false) {
    dialog.value = '';
    region.value = selectedRegion;
    boundaries.value = await getBoundaries(region.value.id);
    boundariesCategory.value = Array.from(new Set(boundaries.value.map(b => b.category)));
    electionTraits.value = await getElectionTraits(region.value.id);
    loadVisibleElectionTraits();
    if (clicked) {
        dialog.value = 'boundary';
    }
    localStorage.setItem('region', region.value.id);
}

async function selectBoundary(selectedBoundary: Feature, clicked: boolean = false) {
    document.title = selectedBoundary.name;
    dialog.value = '';
    boundary.value = selectedBoundary;
    if (map1.value) {
        await map1.value.selectBoundary(selectedBoundary, true);
    }
    if (map2.value) {
        await map2.value.selectBoundary(selectedBoundary, true);
    }
    if (clicked) {
        pushState();
    }
}

async function selectRegionAndBoundary(regionId: string, boundaryName: string, clicked: boolean = false) {
    const targetRegion = regions.value.find(r => r.id === regionId);
    if (!targetRegion) {
        return;
    }
    if (region.value !== targetRegion) {
        await selectRegion(targetRegion);
    }

    const targetBoundary = boundaries.value.find(b => b.name === boundaryName);
    if (!targetBoundary) {
        return;
    }
    if (boundary.value !== targetBoundary) {
        await selectBoundary(targetBoundary, clicked);
    }
}

function cloneBoundary() {
    if (boundary.value && map2.value) {
        map2.value.selectBoundary(boundary.value, false);
    }
}

async function showAllRidings() {
    boundary.value = null;
    if (map1.value) {
        loading.value = true;
        await map1.value.loadAllRidings();
        loading.value = false;
    }
    //showInfo('Showing all federal ridings. Click on a riding to load more information.');
}

function clickRiding(props: any) {
    console.log(props);
    selectRegionAndBoundary(props.region_id, '2023 Federal Ridings: ' + props.name, true);
}

/** Refreshes data after the trait list is customized. */
async function loadData() {
    dialog.value = '';
    saveVisibleTraits();
    purgeCensusData();
    if (map1.value) {
        map1.value.loadData();
    }
    if (map2.value) {
        map2.value.loadData();
    }
}

/** Save the user's visible trait selection to local storage. */
function saveVisibleTraits() {
    const visibleCensusTraits = censusTraits.value.filter(t => t.visible).map(t => t.id);
    localStorage.setItem('censusTraits', JSON.stringify(visibleCensusTraits));
    const visibleElectionTraits = electionTraits.value.filter(t => t.visible).map(t => t.name);
    localStorage.setItem('electionTraits', JSON.stringify(visibleElectionTraits));
}

function loadVisibleCensusTraits() {
    const last = localStorage.getItem('censusTraits');
    if (!last) {
        return;
    }
    const visibleList = JSON.parse(last) as number[];
    censusTraits.value.forEach(t => {
        t.visible = visibleList.includes(t.id);
    });
}

function loadVisibleElectionTraits() {
    const last = localStorage.getItem('electionTraits');
    if (!last) {
        return;
    }
    const visibleList = JSON.parse(last) as string[];
    let count = 0;
    electionTraits.value.forEach(t => {
        t.visible = visibleList.includes(t.name);
        if (t.visible) {
            count++;
        }
    });
}

function pushState() {
    const url = `#/${region.value?.id}/${boundary.value?.name}`;
    if (window.location.hash !== url) {
        window.history.pushState(undefined, '', url);
    }
}

function popState() {
    dialog.value = '';
    const [regionId, boundaryName] = window.location.hash.substring(2).split('/').map(s => decodeURIComponent(s));
    //console.log('popState', regionId, boundaryName);
    selectRegionAndBoundary(regionId, boundaryName);
}

function indent(text: string) {
    // convert leading spaces to &nbsp;
    const count = text.length - text.trimStart().length;
    return '&nbsp;'.repeat(count);
};


</script>

<template>
    <header>
        <div>
            <h1>Electoral Maps .ca</h1>
        </div>
        <div>
            <a href="#" @click.prevent="dialog = 'region'" class="dropdown">{{ region ? region.name : "Select..." }}</a>
        </div>
        <div v-if="region">
            <a href="#" @click.prevent="dialog = 'boundary'" class="dropdown">{{ boundary ? boundary.name : "Select..." }}</a>
        </div>
        <div>
            <a href="#" @click="showAllRidings">Show All Federal Ridings</a>
        </div>
        <div>
            <a href="#" @click.prevent="dialog = 'about'">About</a>
        </div>
        <div style="flex: 1; display: flex; gap: 10px; justify-content: right;">
            <input type="checkbox" v-model="dual" class="toggler" title="Toggle split view map mode" />
        </div>

    </header>
    <div class="loading" v-show="loading">
        <p>Loading...</p>
    </div>
    <div class="maps">
        <Map
            ref="map1"
            key="map1"
            :censusTraits="censusTraits.filter((t) => t.visible)"
            :electionTraits="electionTraits"
            @customize="dialog = 'trait'"
            @loading="loading = $event"
            @click="clickRiding"
        />
        <Map
            ref="map2"
            key="map2"
            :censusTraits="censusTraits.filter((t) => t.visible)"
            :electionTraits="electionTraits"
            @customize="dialog = 'trait'"
            @mounted="cloneBoundary"
            @loading="loading = $event"
            v-if="dual"
        />
    </div>

    <div class="dialog-bg" v-show="dialog != ''"></div>

    <div class="dialog" v-show="dialog == 'region'">
        <p>Please select your province:</p>
        <ul class="cols">
            <li v-for="r in regions" :key="r.id">
                <a href="#" @click.prevent="selectRegion(r, true);">{{ r.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="dialog == 'boundary'">
        <p><strong>Please select an electoral boundary.</strong> This site gives you the flexibility to view any election results independently of which boundary was used in the original election.
            You can see election results exactly as they appeared, or you can also view past election results as they would have looked in a redrawn boundary.
            If you are running a municipal election, you can view federal and provincial election results just within your municipal boundary.</p>
        <p>The 2015, 2019, and 2021 federal general elections used the 2013 riding representation.</p>
        <p><strong>The 2025 federal general election used the 2023 riding representation.</strong></p>
        <div style="display: flex; gap: 10px;">
            <div v-for="category in boundariesCategory" :key="category">
                <p><strong>{{ category }}</strong></p>
                <ul>
                    <li v-for="b in boundaries.filter(x => x.category == category)" :key="b.mapId + '-' + b.featureId">
                        <a href="#" @click.prevent="selectBoundary(b, true)">{{ b.name.replace(category + ': ', '') }}</a>
                    </li>
                </ul>
            </div>
        </div>
    </div>

    <div class="dialog" v-show="dialog == 'trait'">
        <div style="position: sticky; top: -20px; background-color: #fff; z-index: 1; padding: 10px 0;">
            <p><input type="button" value="Save Changes..." @click.prevent="loadData()" /></p>
        </div>
        <ul class="check-list">
            <li><strong>Election Traits:</strong></li>
            <li v-for="t in electionTraits">
                <label><input type="checkbox" v-model="t.visible" :key="t.name" />{{ t.name }}</label>
            </li>
        </ul>
        <ul class="check-list">
            <li><strong>Census Traits:</strong></li>
            <li v-for="t in censusTraits">
                <label><input type="checkbox" v-model="t.visible" :key="t.id" /><span class="trait-id">{{ t.id }}</span><span v-html="indent(t.name)"></span>{{ t.name }}</label>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="dialog == 'about'">

        <p>This site currently contains data for:</p>
        <ul>
            <li>2021 Canadian Census</li>
            <li>2019 Canadian General Election</li>
            <li>2021 Canadian General Election</li>
            <li>2025 Ontario General Election</li>
        </ul>
        <p>Data for the following is not available yet:</p>
        <ul>
            <li>2025 Canadian General Election</li>
            <li>2024 British Columbia General Election</li>
        </ul>

        <p>Census data is provided by Statistics Canada. 2023. Census Profile. 2021 Census of Population. Statistics Canada Catalogue number 98-316-X2021001. Ottawa. Released November 15, 2023.</p>
        <p>Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.</p>

        <p>I can be reached at contact@electoralmaps.ca</p>

        <p><button type="button" @click="dialog = ''">Close</button></p>

    </div>
</template>

<style>

.map {
    height: calc(100vh - 50px);
    flex: 1;
}

.maps {
    display: flex;
    gap: 10px;
}

.trait-id {
    font-size: 0.8em;
    color: #888;
    margin-right: 5px;
}

.loading {
    display: flex;
    position: fixed;
    top: 30%;
    left: 0;
    right: 0;
    height: 200px;
    z-index: 1000;
    background-color: rgba(255, 255, 255, 0.7);
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-size: 4em;
    transition: all 0.5s;
}
</style>
