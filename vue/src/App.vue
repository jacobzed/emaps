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
import 'vue-toast-notification/dist/theme-default.css';

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
            region: undefined as Region | undefined,
            boundaries: [] as Feature[],
            boundary: undefined as Feature | undefined,
            censusTraits: [] as CensusTrait[],
            electionTraits: [] as ElectionTrait[],
            dual: false,
        };
    },
    async mounted() {
        try {
            this.censusTraits = await getCensusTraits();
            this.regions = await getRegions();

            if (window.location.hash) {
                await this.popState();
            }
            else {
                const region = this.regions.find(r => r.id == 'BC');
                this.selectRegion(region!);
            }
            window.addEventListener('popstate', this.popState);

        } catch (e) {
            this.showError(e);
        }
    },
    methods: {
        showError: function (error: any) {
            console.error(error);
            $toast.open({ message: error, type: 'error', position: 'top-right' });
        },
        async selectRegion(region: Region, clicked: boolean = false) {
            this.picker = '';
            this.region = region;
            this.boundaries = await getBoundaries(this.region.id);
            this.electionTraits = await getElectionTraits(this.region.id);
            if (clicked) {
                this.picker = 'boundary';
            }
        },
        async selectBoundary(boundary: Feature, clicked: boolean = false) {
            document.title = boundary.name;
            this.picker = '';
            this.boundary = boundary;
            await (this.$refs.map1 as any).selectBoundary(boundary);
            if (this.$refs.map2) {
                await (this.$refs.map2 as any).selectBoundary(boundary);
            }
            if (clicked) {
                this.pushState();
            }
        },
        cloneBoundary() {
            if (this.boundary) {
                //(this.$refs.map1 as any).selectBoundary(this.boundary);
                if (this.$refs.map2) {
                    (this.$refs.map2 as any).selectBoundary(this.boundary);
                }
            }
        },
        async loadTraits() {
            this.picker = '';
            purgeCensusData();
            (this.$refs.map1 as any).loadData();
            if (this.$refs.map2) {
                (this.$refs.map2 as any).loadData();
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
            const [_region, _boundary] = window.location.hash.substring(2).split('/').map(s => decodeURIComponent(s));
            console.log('popState', _region, _boundary);

            const region = this.regions.find(r => r.id === _region);
            if (!region) {
                return;
            }
            if (this.region !== region) {
                await this.selectRegion(region);
            }

            const boundary = this.boundaries.find(b => b.name === _boundary);
            if (!boundary) {
                return;
            }
            if (this.boundary !== boundary) {
                await this.selectBoundary(boundary);
            }

        },
        indent(text: string) {
            // convert leading spaces to &nbsp;
            const count = text.length - text.trimStart().length;
            return '&nbsp;'.repeat(count);
        },
    },
    errorCaptured(err, instance, info) {
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
            <a href="#" @click.prevent="picker = 'region'" class="button">{{ region ? region.name : "Select..." }}</a>
        </div>
        <div v-if="region">
            <a href="#" @click.prevent="picker = 'boundary'" class="button">{{ boundary ? boundary.name : "Select..." }}</a>
        </div>
        <div>
            <input type="checkbox" v-model="dual" class="toggler" title="Toggle split view map mode" />
        </div>

        <div style="flex: 1; text-align: right;">
            <a href="#" @click.prevent="picker = 'about'">About</a>
        </div>

    </header>
    <div v-if="!region || !boundary" style="padding: 20px; font-size: 1.5em;">
        <p>To get started, use the dropdowns above to select a province and electoral district.</p>
    </div>
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
        <p>Select a boundary (ridings use new 2023 representation order, cities use census subdivisions which generally correspond to municipal boundaries): </p>
        <ul class="cols">
            <li v-for="b in boundaries" :key="b.mapId + '-' + b.featureId">
                <a href="#" @click.prevent="selectBoundary(b, true)">{{ b.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'trait'">
        <div style="position: sticky; top: -20px; background-color: #fff; z-index: 1; padding: 10px 0;">
            <p><input type="button" value="Save changes..." @click.prevent="loadTraits()" /></p>
        </div>
        <ul>
            <li><strong>Election Traits:</strong></li>
            <li v-for="t in electionTraits">
                <label><input type="checkbox" v-model="t.active" />{{ t.name }}</label>
            </li>
        </ul>
        <ul>
            <li><strong>Census Traits:</strong></li>
            <li v-for="t in censusTraits">
                <label><input type="checkbox" v-model="t.active" /><span class="trait-id">{{ t.id }}</span><span v-html="indent(t.name)"></span>{{ t.name }}</label>
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
