/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

Typical use would look like this:

1. User selects a region (province, territory, or state). This is used to limit the UI
options by only showing relevant boundaries and data for that region.

2. User selects a geographic boundary within the region. This is used to further narrow
the data that can be loaded. This would typically be a city, electoral district, or other
administrative boundary.

3. User selects a census or electoral data trait to display on the map.
Each trait has an associated map ID, which is used to load geographic features for that trait.
Those features are then color coded based on the associated data.
e.g. census data will reference census DA maps
e.g. electoral data will reference voting area (poll) maps

*/

<script lang="ts">
import type { Region, Feature, CensusTrait, ElectionTrait } from "./components/api";
import { getRegions, getCensusTraits, getElectionTraits, getBoundaries } from "./components/api";
import { purgeCensusData } from "./components/data";
import Map from "./components/Map.vue";
import {useToast} from 'vue-toast-notification';

const $toast = useToast();

export default {
    components: {
        Map,
    },
    data() {
        return {
            picker: '',
            loading: false,
            regions: [] as Region[],
            region: null as Region | null,
            boundaries: [] as Feature[],
            boundary: null as Feature | null,
            censusTraits: [] as CensusTrait[],
            electionTraits: [] as ElectionTrait[],
            dual: false,
        };
    },
    async mounted() {
        try {
            this.censusTraits = await getCensusTraits();
            this.refreshPreferredCensusTraits();
            this.regions = await getRegions();

            if (window.location.hash) {
                await this.popState();
            }
            else {
                const last = localStorage.getItem('region') || 'BC';
                const region = this.regions.find(r => r.id == last);
                this.selectRegion(region!);
            }
            window.addEventListener('popstate', this.popState);

        } catch (e) {
            this.showError(e);
        }
    },
    methods: {
        showInfo: function (message: string) {
            $toast.open({ message, type: 'info', position: 'top-left' });
        },
        showError: function (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(message);
            $toast.open({ message, type: 'error', position: 'top-left' });
        },
        async selectRegion(region: Region, clicked: boolean = false) {
            this.picker = '';
            this.region = region;
            this.boundaries = await getBoundaries(this.region.id);
            this.electionTraits = await getElectionTraits(this.region.id);
            this.refreshPreferredElectionTraits();
            if (clicked) {
                this.picker = 'boundary';
            }
            localStorage.setItem('region', region.id);
        },
        async selectBoundary(boundary: Feature, clicked: boolean = false) {
            document.title = boundary.name;
            this.picker = '';
            this.boundary = boundary;
            await (this.$refs.map1 as InstanceType<typeof Map>).selectBoundary(boundary);
            if (this.$refs.map2) {
                await (this.$refs.map2 as InstanceType<typeof Map>).selectBoundary(boundary);
            }
            if (clicked) {
                this.pushState();
            }
        },
        async selectRegionAndBoundary(regionId: string, boundaryName: string, clicked: boolean = false) {
            const region = this.regions.find(r => r.id === regionId);
            if (!region) {
                return;
            }
            if (this.region !== region) {
                await this.selectRegion(region);
            }

            const boundary = this.boundaries.find(b => b.name === boundaryName);
            if (!boundary) {
                return;
            }
            if (this.boundary !== boundary) {
                await this.selectBoundary(boundary, clicked);
            }
        },
        cloneBoundary() {
            if (this.boundary) {
                if (this.$refs.map2) {
                    (this.$refs.map2 as InstanceType<typeof Map>).selectBoundary(this.boundary);
                }
            }
        },
        showAllRidings() {
            this.boundary = null;
            const map = this.$refs.map1 as InstanceType<typeof Map>;
            map.loadAllRidings();
            //this.showInfo('Showing all federal ridings. Click on a riding to load more information.');
        },
        clickRiding(props: any) {
            this.selectRegionAndBoundary(props.region_id, '2025 Riding: ' + props.name, true);
        },
        async selectTraits() {
            this.picker = '';
            this.savePreferredCensusTraits();
            this.savePreferredElectionTraits();
            purgeCensusData();
            (this.$refs.map1 as InstanceType<typeof Map>).loadData();
            if (this.$refs.map2) {
                (this.$refs.map2 as InstanceType<typeof Map>).loadData();
            }
        },
        savePreferredCensusTraits() {
            const selected = this.censusTraits.filter(t => t.active).map(t => t.id);
            localStorage.setItem('censusTraits', JSON.stringify(selected));
        },
        refreshPreferredCensusTraits() {
            const last = localStorage.getItem('censusTraits');
            if (!last) {
                return;
            }
            const selected = JSON.parse(last);
            this.censusTraits.forEach(t => {
                t.active = selected.includes(t.id);
            });
        },
        savePreferredElectionTraits() {
            const selected = this.electionTraits.filter(t => t.active).map(t => t.name);
            localStorage.setItem('electionTraits', JSON.stringify(selected));
        },
        refreshPreferredElectionTraits() {
            const last = localStorage.getItem('electionTraits');
            if (!last) {
                return;
            }
            const selected = JSON.parse(last)
            let count = 0;
            this.electionTraits.forEach(t => {
                t.active = selected.includes(t.name);
                if (t.active) {
                    count++;
                }
            });
            // If traits are ever renamed we will need to reset to the defaults
            if (count == 0) {
                this.electionTraits.forEach(t => {
                    t.active = t.electionId == 44;
                });
            }
        },
        pushState() {
            const url = `#/${this.region?.id}/${this.boundary?.name}`;
            if (window.location.hash !== url) {
                window.history.pushState(undefined, '', url);
            }
        },
        async popState() {
            this.picker = '';
            const [region, boundary] = window.location.hash.substring(2).split('/').map(s => decodeURIComponent(s));
            //console.log('popState', region, boundary);
            this.selectRegionAndBoundary(region, boundary);
        },
        indent(text: string) {
            // convert leading spaces to &nbsp;
            const count = text.length - text.trimStart().length;
            return '&nbsp;'.repeat(count);
        },
    },
    errorCaptured(err: unknown) {
        this.loading = false;
        this.showError(err);
        return false;
    },
};
</script>

<template>
    <header>
        <div>
            <h1>Electoral Maps .ca</h1>
        </div>
        <div>
            <a href="#" @click.prevent="picker = 'region'" class="dropdown">{{ region ? region.name : "Select..." }}</a>
        </div>
        <div v-if="region">
            <a href="#" @click.prevent="picker = 'boundary'" class="dropdown">{{ boundary ? boundary.name : "Select..." }}</a>
        </div>
        <div>
            <a href="#" @click="showAllRidings">Show All Ridings</a>
        </div>
        <div>
            <a href="#" @click.prevent="picker = 'about'">About</a>
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
            :censusTraits="censusTraits.filter((t) => t.active)"
            :electionTraits="electionTraits"
            @customize="picker = 'trait'"
            @loading="loading = $event"
            @click="clickRiding"
        />
        <Map
            ref="map2"
            key="map2"
            :censusTraits="censusTraits.filter((t) => t.active)"
            :electionTraits="electionTraits"
            @customize="picker = 'trait'"
            @mounted="cloneBoundary"
            @loading="loading = $event"
            v-if="dual"
        />
    </div>

    <div class="dialog-bg" v-show="picker != ''"></div>

    <div class="dialog" v-show="picker == 'region'">
        <p>Select a region:</p>
        <ul class="cols">
            <li v-for="r in regions" :key="r.id">
                <a href="#" @click.prevent="selectRegion(r, true);">{{ r.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'boundary'">
        <p>Select a boundary (federal ridings available in 2013 and 2023 representation orders, cities use census subdivisions which generally correspond to municipal boundaries): </p>
        <ul class="cols">
            <li v-for="b in boundaries" :key="b.mapId + '-' + b.featureId">
                <a href="#" @click.prevent="selectBoundary(b, true)">{{ b.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'trait'">
        <div style="position: sticky; top: -20px; background-color: #fff; z-index: 1; padding: 10px 0;">
            <p><input type="button" value="Save Changes..." @click.prevent="selectTraits()" /></p>
        </div>
        <ul>
            <li><strong>Election Traits:</strong></li>
            <li v-for="t in electionTraits">
                <label><input type="checkbox" v-model="t.active" :key="t.name" />{{ t.name }}</label>
            </li>
        </ul>
        <ul>
            <li><strong>Census Traits:</strong></li>
            <li v-for="t in censusTraits">
                <label><input type="checkbox" v-model="t.active" :key="t.id" /><span class="trait-id">{{ t.id }}</span><span v-html="indent(t.name)"></span>{{ t.name }}</label>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'about'">

        <p>Census data is provided by Statistics Canada. 2023. Census Profile. 2021 Census of Population. Statistics Canada Catalogue number 98-316-X2021001. Ottawa. Released November 15, 2023.</p>
        <p>Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.</p>

        <p>I can be reached at contact@electoralmaps.ca</p>

        <p><button type="button" @click="picker = ''">Close</button></p>

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
