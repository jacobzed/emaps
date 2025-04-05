/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.


The Map component plots geographic features and their associated data.
The code here is tightly coupled with the backend API.

Typical use would look like this:

1. User selects a region (province, territory, or state).
This is used to limit the UI options by only showing relevant boundaries and data for that region.

2. User selects a geographic boundary within the region.
This is used to further narrow the data that can be loaded.
This would typically be a city, electoral district, or other administrative boundary.

3. User selects a census or electoral data trait to display on the map.
Each trait has an associated map ID, which is used to load geographic features for that trait.
Those features are then color coded based on the associated data.
e.g. census data will reference census DA maps
e.g. electoral data will reference voting area (poll) maps

*/

<script lang="ts">
import { MapHelper } from './MapHelper';
import type { Region, Feature, CensusTrait, ElectionTrait } from './api';
import { getRegions, getCensusTraits, getElectionTraits, getBoundaries, getFeature, getIntersectingFeatures } from './api';
import type { Tooltip, Legend } from './data';
import { loadElectionData, loadCensusData, purgeCensusData, loadCensusTraits, getTooltip } from './data';

/** The MapHelper instance doesn't need to be reactive. */
let map: MapHelper;

export default {
  data: function () {
    return {
      picker: '',
      regions: [] as Region[],
      region: null as Region | null,
      boundaries: [] as Feature[],
      boundary: null as Feature | null,
      censusTraits: [] as CensusTrait[],
      electionTraits: [] as ElectionTrait[],
      trait: null as CensusTrait | ElectionTrait | null,
      legend: null as Legend | null,
      tooltip: null as Tooltip | null,
    }
  },
  async mounted() {
    map = new MapHelper(this.$refs.map as HTMLElement);
    map.onMouseOver = this.onMouseOver;
    map.onMouseOut = this.onMouseOut;
    this.regions = await getRegions();
    const region = this.regions.find(r => r.id == 'BC') as Region;
    this.selectRegion(region);
    // Census traits are universal and can be loaded before a region is selected
    // Election traits are specific to a region and must be loaded after a region is selected
    this.censusTraits = await getCensusTraits();
  },
  methods: {
    async selectRegion(region: Region) {
      this.region = region;
      this.picker = '';
      this.boundaries = await getBoundaries(this.region.id);
      this.electionTraits = await getElectionTraits(this.region.id);
    },
    async selectBoundary(boundary: Feature) {
      document.title = boundary.name;
      this.boundary = boundary;
      this.picker = '';
      const geojson = await getFeature(this.boundary.mapId, this.boundary.featureId);
      // Convert the Polygon features to LineString geometry so the MapHelper displays them as polylines.
      geojson.features.forEach((f: any) => {
        f.geometry.type = f.geometry.type.replace('Polygon', 'LineString');
      });
      const layer = map.addLayer({ name: 'Boundary' }, geojson);
      map.showLayer(layer);
      await this.loadFeatures();
      await this.loadData();
    },
    async selectTrait(trait: CensusTrait | ElectionTrait) {
      console.log(trait);
      this.trait = trait;
      await this.loadFeatures();
      await this.loadData();
    },
    /** Load the features for the selected trait. */
    async loadFeatures() {
      if (!this.boundary || !this.trait)
        return;

      // Most traits will be sharing a map, so we can use a previously loaded map most of the time.
      const name = 'Map-' + this.trait.mapId + '-' + this.boundary.mapId + '-' + this.boundary.featureId;
      let layer = map.findLayer(name);
      if (layer) {
        map.showLayer(layer);
        return;
      }

      const geojson = await getIntersectingFeatures(this.trait.mapId, this.boundary.mapId, this.boundary.featureId);
      if (!geojson.features) {
        console.error('No features found for ' + name);
        return;
      }

      layer = map.addLayer({ name, label: 'id' }, geojson);
      map.showLayer(layer);
    },
    async loadTraits() {
      purgeCensusData();
      await this.loadData();
    },
    /** Load data for the selected trait. */
    async loadData() {
      this.picker = '';
      if (!this.trait)
        return;

      const layer = map.activeLayer();
      if (!layer)
        return;

      if (this.trait.type == 'election') {
        this.legend = await loadElectionData(layer, this.trait);
      } else if (this.trait.type == 'census') {
        this.legend = await loadCensusData(layer, this.trait, this.censusTraits.filter(t => t.active));
      }

      // The load functions above will have assigned the getStyle callback to the layer
      map.refreshLayer(layer);

    },
    onMouseOver(props: any) {
      this.tooltip = getTooltip(props, this.trait!);
    },
    onMouseOut(props: any) {
      this.tooltip = null;
    },
    indent(text: string) {
      // convert leading spaces to &nbsp;
      const count = text.length - text.trimStart().length;
      return '&nbsp;'.repeat(count);
    }
  },
  errorCaptured(err, instance, info) {
    console.error('Error in Map component:', err, info);
    return false;
  }
}
</script>

<template>
  <div class="dialog-bg" v-show="picker != ''"></div>

  <div class="dialog" v-show="picker == 'region'">
    <p>Select a region:</p>
    <ul class="cols">
      <li v-for="r in regions" :key="r.id"><a href="#" @click.prevent="selectRegion(r); picker = 'boundary'">{{ r.name }}</a></li>
    </ul>
  </div>

  <div class="dialog" v-show="picker == 'boundary'">
    <p>Select a boundary (federal ridings use the 2013 representation order, cities use census subdivisions which generally correspond to municipality boundaries):</p>
    <ul class="cols">
      <li v-for="b in boundaries" :key="b.mapId + '-' + b.featureId"><a href="#" @click.prevent="selectBoundary(b)">{{ b.name }}</a></li>
    </ul>
  </div>

  <div class="dialog" v-show="picker == 'trait'">
    <div style="position: sticky; top: -20px; background-color: #fff; z-index: 1; padding: 10px 0;">
      <p><input type="button" value="Save changes..." @click.prevent="loadTraits()" /></p>
    </div>
    <ul>
      <li>Election Traits:</li>
      <li v-for="t in electionTraits"><label><input type="checkbox" v-model="t.active">{{ t.name }}</label></li>
    </ul>
    <ul>
      <li>Census Traits:</li>
      <li v-for="t in censusTraits"><label><input type="checkbox" v-model="t.active"><span class="trait-id">{{ t.id }}</span><span v-html="indent(t.name)"></span>{{ t.name }}</label></li>
    </ul>
  </div>


  <div class="map">
    <div ref="map"></div>
    <div>

      <div>
        <a href="#" @click.prevent="picker = 'region'" class="button">{{ region ? region.name : 'Select...' }}</a>
      </div>

      <div v-if="region">
        <a href="#" @click.prevent="picker = 'boundary'" class="button">{{ boundary ? boundary.name : 'Select...' }}</a>
      </div>

      <slot></slot>

      <div class="radio-list" v-show="boundary && !tooltip">
        <label v-for="t in electionTraits.filter(t => t.active)"><input type="radio" v-model="trait" :value="t" @click="selectTrait(t)">{{ t.name }}</label>
        <label v-for="t in censusTraits.filter(t => t.active)"><input type="radio" v-model="trait" :value="t" @click="selectTrait(t)"><span v-if="t.category" v-bind:title="'#' + t.id">{{ t.category }}: </span>{{ t.name }}</label>
        <p><a href="#" @click.prevent="picker = 'trait'">Customize layers...</a></p>
      </div>

      <div v-if="tooltip && tooltip.type == 'election'">
        <p><strong>{{ tooltip.title }}</strong></p>
        <div v-for="r in tooltip.results" class="tooltip-item">
          <div>{{ r.party }} ({{ (r.pct * 100).toFixed(1) }}%)</div>
          <div class="tooltip-chart"><div :style="{ width: r.pct * 100 + '%', backgroundColor: r.color }"></div></div>
        </div>
        <p v-if="tooltip.results.length == 0">No data available.</p>
      </div>

      <div v-if="tooltip && tooltip.type == 'census' && trait?.type == 'census'">
        <p><strong>{{ tooltip.title }}</strong></p>
        <div v-for="r in tooltip.results" class="tooltip-item">
          <span v-bind:class="{ 'highlight': r.id == trait.id }">{{ r.name }} ({{ r.value }})</span>
        </div>
        <p v-if="tooltip.results.length == 0">No data available.</p>
      </div>

      <div v-if="legend">
        <p><strong>Legend</strong></p>
        <div v-for="b in legend.bins" class="tooltip-item"><div class="legend" :style="{ backgroundColor: b.color }"></div>{{ b.desc }}</div>
      </div>


    </div>
  </div>
</template>

<style scoped>

.map {
  display: flex;
  height: calc(100vh - 50px);
}

.map > div:nth-child(1) {
  flex: 1;
  height: calc(100vh - 50px);
}

.map > div:nth-child(2) {
  padding: 10px;
  width: 250px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: scroll;
}

.trait-id {
  font-size: 0.8em;
  color: #888;
  margin-right: 5px;
}

.tooltip-chart {
  border: solid 2px #333;
  background-color: #eee;
}

.tooltip-chart > div {
  height: 12px;
}

.tooltip-item {
  margin-bottom: 8px;
}

.highlight {
  background-color: #ff0;
  font-weight: bold;
}

.legend {
  width: 15px;
  height: 15px;
  background-color: #fff;
  margin-right: 5px;
  display: inline-block;
  border: solid 1px #333;
}

</style>
