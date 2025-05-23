/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.


The Map component plots geographic features and their associated data.
It includes a map view and a trait selector for choosing the data to display.
It is tightly coupled with the backend API.

*/

<script lang="ts">
import { shallowRef, type PropType } from 'vue';
import { MapHelper, type MapFeature, type MapLayer } from './MapHelper';
import type { Region, Feature, CensusTrait, ElectionTrait } from './api';
import { getBoundingBoxFeatures, getFeature, getFeatures, getIntersectingFeatures } from './api';
import type { Tooltip, Legend } from './data';
import { loadElectionData, loadCensusData, purgeCensusData, getTooltip } from './data';


export default {
  name: 'Map',
  props: {
    censusTraits: {
      type: Array as PropType<CensusTrait[]>,
      required: true
    },
    electionTraits: {
      type: Array as PropType<ElectionTrait[]>,
      required: true
    }
  },
  emits: ['customize', 'mounted', 'loading', 'click'],
  data: function () {
    return {
      trait: null as CensusTrait | ElectionTrait | null,
      legend: null as Legend | null,
      tooltip: null as Tooltip | null,
      boundary: null as Feature | null,
    }
  },
  setup() {
    // This setup is used to create a non-reactive map reference.
    // Putting the map reference in data() and making it reactive creates subtle bugs
    return {
      //map: shallowRef<MapHelper>(null!),
      map: null! as MapHelper,
    }
  },
  async mounted() {
    console.log('creating map instance...')
    this.map = new MapHelper(this.$refs.mapdiv as HTMLElement);
    // experiment with only loading ridings within the map bounds
    // this.map.onBoundsChanged = async () => {
    //   const zoom = this.map.getZoom();
    //   const bounds = this.map.getBounds().toJSON();
    //   console.log(zoom, bounds);
    //   const geojson = await getBoundingBoxFeatures(30, zoom, bounds);
    //   const layer = this.map.addLayer({ name: 'Ridings', label: 'name', labelMinZoom: 11 }, geojson);
    //   this.map.showLayer(layer);
    // };

    this.$emit('mounted');
  },
  unmounted() {
    console.log('destroying map instance...')
    if (this.map) {
      this.map.destroy();
    }
  },
  methods: {
    async selectBoundary(boundary: Feature) {
      this.boundary = boundary;
      const geojson = await getFeature(this.boundary.mapId, this.boundary.featureId);
      // Convert the Polygon features to LineString geometry so the MapHelper displays them as polylines.
      geojson.features.forEach((f: any) => {
        f.geometry.type = f.geometry.type.replace('Polygon', 'LineString');
      });
      const layer = this.map.addLayer({ name: 'Boundary' }, geojson);
      this.map.showLayer(layer);
      this.tooltip = null;

      // If no trait is selected, select the first census trait
      if (this.trait == null) {
        const traits = this.censusTraits.filter(t => t.active);
        if (traits.length > 0) {
          this.trait = traits[0];
        }
      }
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
      let layer = this.map.findLayer(name);
      if (layer) {
        this.map.showLayer(layer);
        return;
      }

      this.$emit('loading', true);
      const geojson = await getIntersectingFeatures(this.trait.mapId, this.boundary.mapId, this.boundary.featureId);
      this.$emit('loading', false);
      if (!geojson.features) {
        console.error('No features found for ' + name);
        return;
      }

      layer = this.map.addLayer({ name, label: 'id', onMouseOver: this.onMouseOver, onMouseOut: this.onMouseOut }, geojson);
      this.map.showLayer(layer);
    },
    /** Load data for the selected trait. */
    async loadData() {
      const layer = this.map.activeLayer();
      //console.log('loading data for trait', this.trait, layer);
      if (!this.boundary || !this.trait || !layer)
        return;

      this.$emit('loading', true);
      if (this.trait.type == 'election') {
        this.legend = await loadElectionData(layer, this.trait);
      } else if (this.trait.type == 'census') {
        this.legend = await loadCensusData(layer, this.trait, this.censusTraits.filter(t => t.active));
      }
      this.$emit('loading', false);

      // The load functions above will have assigned the getStyle callback to the layer
      this.map.refreshLayer(layer);

    },
    /** Load all federal riding features. */
    async loadAllRidings() {
      this.map.hideAllLayers();
      this.boundary = null;
      this.legend = null;

      let layer = this.map.findLayer('Ridings');
      if (layer) {
        this.map.showLayer(layer);
        return;
      }
      const geojson = await getFeatures(32);
      const onClick = (feature: MapFeature, props: any, layer: MapLayer) => {
        this.$emit('click', props);
      };
      layer = this.map.addLayer({ name: 'Ridings', label: 'name', labelMinZoom: 11, onClick, onMouseOver: this.onMouseOverRiding, onMouseOut: this.onMouseOut }, geojson);
      this.map.showLayer(layer);
    },
    onMouseOver(feature: MapFeature, props: any) {
      if (this.trait) {
        this.tooltip = getTooltip(props, this.trait);
      }
    },
    onMouseOut(feature: MapFeature, props: any) {
      this.tooltip = null;
    },
    onMouseOverRiding(feature: MapFeature, props: any) {
      this.tooltip = { type: 'election', title: props.name, results: [], notes: 'Click to load the election results and census data for this riding.' };
    },
    getLocation() {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bounds = this.map.getBounds();
      return { lat: center.lat(), lng: center.lng(), zoom, bounds: bounds.toJSON() };
    },
  },
}
</script>

<template>

  <div class="map">
    <div ref="mapdiv"></div>
    <div>
      <div class="radio-list" v-show="boundary && !tooltip">
        <p><a href="#" @click.prevent="$emit('customize')" class="button">Customize layers...</a></p>
        <label v-for="t in electionTraits.filter(t => t.active)">
          <input type="radio" v-model="trait" :value="t" :key="t.name" @click="selectTrait(t)">{{ t.name }}
        </label>
        <label v-for="t in censusTraits.filter(t => t.active)">
          <input type="radio" v-model="trait" :value="t" :key="t.id" @click="selectTrait(t)"><span v-if="t.category" v-bind:title="'#' + t.id">{{ t.category }}: </span>{{ t.name }}
        </label>
      </div>

      <div v-if="!boundary && !tooltip">
        <p><strong>Select a riding</strong></p>
        <p>Please select a riding from the dropdown on the top menu or <a href="#" @click="loadAllRidings">show all ridings</a>.</p>
      </div>

      <div v-if="tooltip && tooltip.type == 'election'">
        <p><strong>{{ tooltip.title }}</strong></p>
        <p class="notes">{{ tooltip.notes }}</p>
        <div v-for="r in tooltip.results" class="tooltip-item">
          <div>{{ r.party }} ({{ (r.pct * 100).toFixed(1) }}%)</div>
          <div class="tooltip-chart">
            <div :style="{ width: r.pct * 100 + '%', backgroundColor: r.color }"></div>
          </div>
        </div>
        <p v-if="tooltip.results.length == 0 && !tooltip.notes">No data available.</p>
      </div>

      <div v-if="tooltip && tooltip.type == 'census' && trait?.type == 'census'">
        <p><strong>{{ tooltip.title }}</strong></p>
        <div v-for="r in tooltip.results" class="tooltip-item">
          <span v-bind:class="{ 'highlight': r.id == trait.id }">{{ r.name }} ({{ r.value }})</span>
        </div>
        <p v-if="tooltip.results.length == 0 && !tooltip.notes">No data available.</p>
      </div>

      <div v-if="legend && trait">
        <p><strong>{{ trait.name }}</strong></p>
        <div v-for="b in legend.bins" class="tooltip-item">
          <div class="legend" :style="{ backgroundColor: b.color }"></div>{{ b.desc }}
        </div>
      </div>


    </div>
  </div>
</template>

<style scoped>
.map {
  display: flex;
}

.map > div:nth-child(1) {
  flex: 1;
}

.map > div:nth-child(2) {
  padding: 10px;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: scroll;
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
  border: solid 2px #333;
}

.notes {
  font-size: 0.9em;
  color: #666;
}
</style>
