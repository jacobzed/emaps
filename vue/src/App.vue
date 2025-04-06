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
            this.region = this.regions.find((r) => r.id == 'BC');
            this.selectRegion(this.region!);
        } catch (e) {
            this.showError(e);
        }
    },
    methods: {
        showError: function (error: any) {
            console.error(error);
            $toast.open({ message: error, type: 'error', position: 'top-right' });
        },
        async selectRegion(region: Region) {
            this.picker = '';
            this.region = region;
            this.boundaries = await getBoundaries(this.region.id);
            this.electionTraits = await getElectionTraits(this.region.id);
        },
        async selectBoundary(boundary: Feature) {
            document.title = boundary.name;
            this.picker = '';
            this.boundary = boundary;
            (this.$refs.map1 as any).selectBoundary(boundary);
            if (this.$refs.map2) {
                (this.$refs.map2 as any).selectBoundary(boundary);
            }
        },
        cloneBoundary() {
            if (this.boundary) {
                (this.$refs.map1 as any).selectBoundary(this.boundary);
                if (this.$refs.map2) {
                    (this.$refs.map2 as any).selectBoundary(this.boundary);
                }
            }
        },
        async loadTraits() {
            this.picker = "";
            purgeCensusData();
            (this.$refs.map1 as any).loadData();
            if (this.$refs.map2) {
                (this.$refs.map2 as any).loadData();
            }
        },
        indent(text: string) {
            // convert leading spaces to &nbsp;
            const count = text.length - text.trimStart().length;
            return '&nbsp;'.repeat(count);
        },
    },
    errorCaptured(err, instance, info) {
        this.showError('Error: ' + err);
        return false;
    },
};
</script>

<template>
    <header>
        <div>
            <h1>Electoral Mapper</h1>
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

    </header>
    <div class="maps">
        <Map
            ref="map1"
            key="map1"
            :censusTraits="censusTraits.filter((t) => t.active)"
            :electionTraits="electionTraits"
            @customize="picker = 'trait'"
        />
        <Map
            ref="map2"
            key="map2"
            :censusTraits="censusTraits.filter((t) => t.active)"
            :electionTraits="electionTraits"
            @customize="picker = 'trait'"
            @ready="cloneBoundary"
            v-if="dual"
        />
    </div>

    <div class="dialog-bg" v-show="picker != ''"></div>

    <div class="dialog" v-show="picker == 'region'">
        <p>Select a region:</p>
        <ul class="cols">
            <li v-for="r in regions" :key="r.id">
                <a href="#" @click.prevent="selectRegion(r); picker = 'boundary';">{{ r.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'boundary'">
        <p>Select a boundary (cities use census subdivisions which generally correspond to municipal boundaries): </p>
        <ul class="cols">
            <li v-for="b in boundaries" :key="b.mapId + '-' + b.featureId">
                <a href="#" @click.prevent="selectBoundary(b)">{{ b.name }}</a>
            </li>
        </ul>
    </div>

    <div class="dialog" v-show="picker == 'trait'">
        <div style="position: sticky; top: -20px; background-color: #fff; z-index: 1; padding: 10px 0;">
            <p><input type="button" value="Save changes..." @click.prevent="loadTraits()" /></p>
        </div>
        <ul>
            <li>Election Traits:</li>
            <li v-for="t in electionTraits">
                <label><input type="checkbox" v-model="t.active" />{{ t.name }}</label>
            </li>
        </ul>
        <ul>
            <li>Census Traits:</li>
            <li v-for="t in censusTraits">
                <label><input type="checkbox" v-model="t.active" /><span class="trait-id">{{ t.id }}</span><span v-html="indent(t.name)"></span>{{ t.name }}</label>
            </li>
        </ul>
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
</style>
