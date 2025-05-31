/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.


The Map component plots geographic features and their associated data.
It includes a map view and a trait selector for choosing the data to display.
It is tightly coupled with the backend API.

*/

<script setup lang="ts">
import { ref, onMounted, onUnmounted, type PropType } from 'vue';
import { MapHelper, type MapFeature, type MapLayer } from './MapHelper';
import type { Region, Feature, CensusTrait, ElectionTrait } from './api';
import { getFeature, getFeatures, getIntersectingFeatures } from './api';
import type { Tooltip, Legend } from './data';
import { loadElectionData, loadCensusData, purgeCensusData, getTooltip } from './data';

const props = defineProps({
    censusTraits: {
        type: Array as PropType<CensusTrait[]>,
        required: true,
    },
    electionTraits: {
        type: Array as PropType<ElectionTrait[]>,
        required: true,
    },
});

const emit = defineEmits(['customize', 'mounted', 'loading', 'click']);

const trait = ref<CensusTrait | ElectionTrait | null>(null);
const legend = ref<Legend | null>(null);
const tooltip = ref<Tooltip | null>(null);
const boundary = ref<Feature | null>(null);
const mapdiv = ref<HTMLElement | null>(null);


let map: MapHelper = null!;

onMounted(async () => {
    console.log('creating map instance...');
    if (mapdiv.value) {
        map = new MapHelper(mapdiv.value as HTMLElement);
    }
    // experiment with only loading ridings within the map bounds
    // if (map.value) {
    //   map.value.onBoundsChanged = async () => {
    //     const zoom = map.value!.getZoom();
    //     const bounds = map.value!.getBounds().toJSON();
    //     console.log(zoom, bounds);
    //     const geojson = await getBoundingBoxFeatures(30, zoom, bounds);
    //     const layer = map.value!.addLayer({ name: 'Ridings', label: 'name', labelMinZoom: 11 }, geojson);
    //     map.value!.showLayer(layer);
    //   };
    // }

    emit('mounted');
});

onUnmounted(() => {
    console.log('destroying map instance...');
    if (map) {
        map.destroy();
    }
});

/** Select a feature to display as the boundary area. */
async function selectBoundary(selected: Feature) {
    boundary.value = selected;

    const geojson = await getFeature(boundary.value.mapId, boundary.value.featureId);
    // Convert the Polygon features to LineString geometry so the MapHelper displays them as polylines.
    geojson.features.forEach((f: any) => {
        f.geometry.type = f.geometry.type.replace('Polygon', 'LineString');
    });
    const layer = map.addLayer({ name: 'Boundary' }, geojson);
    map.showLayer(layer);
    tooltip.value = null;

    // If no trait is selected, select the first census trait
    if (trait.value == null) {
        const activeCensusTraits = props.censusTraits.filter((t) => t.visible);
        if (activeCensusTraits.length > 0) {
            trait.value = activeCensusTraits[0];
        }
    }
    await loadFeatures();
    await loadData();
}

/** Change the active trait on the map. */
async function selectTrait(selected: CensusTrait | ElectionTrait) {
    console.log(selected);
    trait.value = selected;
    await loadFeatures();
    await loadData();
}

/** Load features for the selected trait. Census traits will load DA maps, election traits will load poll maps. */
async function loadFeatures() {
    if (!boundary.value || !trait.value) return;

    // Most traits will be sharing a map, so we can use a previously loaded map most of the time.
    const name = 'Map-' + trait.value.mapId + '-' + boundary.value.mapId + '-' + boundary.value.featureId;
    let layer = map.findLayer(name);
    if (layer) {
        map.showLayer(layer);
        return;
    }

    emit('loading', true);
    const geojson = await getIntersectingFeatures(trait.value.mapId, boundary.value.mapId, boundary.value.featureId);
    emit('loading', false);
    if (!geojson.features) {
        console.error('No features found for ' + name);
        return;
    }

    layer = map.addLayer({ name, label: 'id', onMouseOver: onMouseOver, onMouseOut: onMouseOut }, geojson);
    map.showLayer(layer);
}

/** Load data for the selected trait and active map features. */
async function loadData() {
    const layer = map.activeLayer();
    //console.log('loading data for trait', trait.value, layer);
    if (!boundary.value || !trait.value || !layer) return;

    emit('loading', true);
    if (trait.value.type == 'election') {
        legend.value = await loadElectionData(layer, trait.value);
    } else if (trait.value.type == 'census') {
        legend.value = await loadCensusData(layer, trait.value, props.censusTraits.filter(t => t.visible));
    }
    emit('loading', false);

    // The load functions above will have assigned the getStyle callback to the layer
    map.refreshLayer(layer);
}

/** Load all federal riding features. */
async function loadAllRidings() {
    map.hideAllLayers();
    boundary.value = null;
    legend.value = null;

    let layer = map.findLayer('Ridings');
    if (layer) {
        map.showLayer(layer);
        return;
    }
    const geojson = await getFeatures(32);
    const onClick = (feature: MapFeature, featureProps: any, mapLayer: MapLayer) => {
        emit('click', featureProps);
    };
    layer = map.addLayer({ name: 'Ridings', label: 'name', labelMinZoom: 11, onClick, onMouseOver: onMouseOverRiding, onMouseOut: onMouseOut, }, geojson);
    map.showLayer(layer);
}

function onMouseOver(feature: MapFeature, featureProps: any) {
    if (trait.value) {
        tooltip.value = getTooltip(featureProps, trait.value);
    }
}

function onMouseOut(feature: MapFeature, featureProps: any) {
    tooltip.value = null;
}

function onMouseOverRiding(feature: MapFeature, featureProps: any) {
    tooltip.value = { type: 'election', title: featureProps.name,  results: [], notes: 'Click to load the election results and census data for this riding.' };
}

function getLocation() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    return { lat: center.lat(), lng: center.lng(), zoom, bounds: bounds.toJSON() };
}


defineExpose({
    loadAllRidings,
    loadData,
    selectBoundary,
});
</script>



<template>

  <div class="map">
    <div ref="mapdiv"></div>
    <div>
      <div class="radio-list" v-show="boundary && !tooltip">
        <p><a href="#" @click.prevent="$emit('customize')" class="button">Customize layers...</a></p>
        <label v-for="t in electionTraits.filter(t => t.visible)">
          <input type="radio" v-model="trait" :value="t" :key="t.name" @click="selectTrait(t)">{{ t.name }}
        </label>
        <label v-for="t in censusTraits.filter(t => t.visible)">
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
