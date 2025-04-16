/*

Copyright (c) 2025 Jacob Zielinski
Licensed under a source-available license. See LICENSE file for details.

*/

/// <reference types="@types/google.maps" />

import { MapLabel } from './MapLabel';
import { PoleLabelPlacement } from './PoleLabelPlacement';

export type MapFeature = google.maps.Polygon | google.maps.Polyline | google.maps.Marker;

/**
 * A styling function for a map layer. Must return an options object that can be passed to
 * Polygon.setOptions, Polyline.setOptions, or Marker.setOptions.
 * e.g. strokeColor, strokeWeight, fillColor, fillOpacity, etc.
 */
export type MapFeatureStylingFunction = (feature: MapFeature, props: any) => google.maps.PolygonOptions | google.maps.PolylineOptions | google.maps.MarkerOptions;

export type MapFeatureCallback = (feature: MapFeature, props: any, layer: MapLayer) => void;

/**
 * A map layer represents a collection of geographic features that can be toggled on/off and styled.
*/
export type MapLayer = {
    name: string;
    /** Display type for layer:
     * Polygon/MultiPolygon => polygon,
     * LineString => polyline,
     * Point => point */
    type?: 'point' | 'polygon' | 'polyline';
    /** Function to customize google maps styling options for selected feature. */
    getStyle?: MapFeatureStylingFunction;
    /** Geographic features of the layer.
     * The following custom properties can be accessed via feature.get('...')
     * 'props' contains the feature's properties.
     * 'label' contains the feature's label.
     */
    features: any[];
    /** Selected features. */
    selected: any[];
    /** Optional property name to display as a label for each feature. */
    label?: string;
    /** Current visibility state of the layer. */
    visible: boolean;
    /** Bounds containing all features of the layer. */
    bounds: google.maps.LatLngBounds;
    /** All IDs of the features in the layer. */
    ids: string[];
    /** Callbacks */
    onClick?: MapFeatureCallback;
    onMouseOver?: MapFeatureCallback;
    onMouseOut?: MapFeatureCallback;
}

/**
 * Options for initializing a map layer.
 */
export type MapLayerOptions = Pick<MapLayer, 'name' | 'label' | 'getStyle' | 'onMouseOver' | 'onMouseOut' | 'onClick'> & {
    /** Min zoom level to show label. Used to prevent label crowding when zoomed out. */
    labelMinZoom?: number;
}


/** Shared state to keep track of the last location for the map. */
let lastLocation: any = null;


/**
 * Helper class for managing map layer visibility, styling, and event handling.
 * It's a more flexible alternative to google.maps.Data.
 */
export class MapHelper {
    private map: google.maps.Map;
    private layers: MapLayer[] = [];
    // public onMouseOver: (props: any) => void = () => { };
    // public onMouseOut: (props: any) => void = () => { };
    // public onClick: (props: any) => void = () => { };
    public onBoundsChanged: () => void = () => { };

    private defaultPolygonOptions: google.maps.PolygonOptions = {
        strokePosition: google.maps.StrokePosition.INSIDE,
        strokeColor: 'black',
        strokeWeight: 1,
        fillColor: '#ddd',
        fillOpacity: 0.3,
        zIndex: 1,
    }

    private defaultPolylineOptions: google.maps.PolylineOptions = {
        strokeColor: 'black',
        strokeWeight: 3,
        zIndex: 2,
    }

    private defaultHighlightOptions: google.maps.PolygonOptions = {
        strokeColor: 'yellow',
        strokeWeight: 5,
        fillOpacity: 0.05,
    }

    constructor(mapElement: HTMLElement) {

        this.map = new google.maps.Map(mapElement, {
            //center: { lat: 43.65107, lng: -79.347015 }, // toronto
            center: { lat: 49.23, lng: -122.98 }, // vancouver
            zoom: 12, // 22=max zoom in, 18=max useful zoom in, 12=city scale zoom, 4=country scale zoom
            // scroll wheel zoom
            scrollwheel: true,
            // disable satellite map type
            mapTypeControl: false,
            // disable fullscreen control
            fullscreenControl: false,
            // restrict zoom/pan to Canada
            restriction: { latLngBounds: { east: -52, west: -132, north: 60, south: 40 } },
            // disable most labels since they create visual clutter
            // https://developers.google.com/maps/documentation/javascript/style-reference#stylers
            styles: [
                {
                    featureType: 'administrative.neighborhood',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }],
                },
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }],
                },
                // {
                //     featureType: 'administrative.locality',
                //     elementType: 'labels',
                //     stylers: [{ visibility: 'off' }]
                // },
            ],

        });

        if (lastLocation) {
            this.map.setZoom(lastLocation.zoom);
            this.map.setCenter(lastLocation.center);
        }

        this.attachBoundsChangedHandlers();
    }

    destroy() {
        google.maps.event.clearInstanceListeners(this.map);
        this.removeAllLayers();
        this.map = null as any;
    }

    /** Remove all layers from the map. */
    private removeAllLayers() {
        for (const layer of this.layers) {
            this.removeLayer(layer);
        }
    }

    /** Find a layer by name. */
    findLayer(name: string) {
        return this.layers.find(l => l.name == name);
    }

    /** Get the active polygon layer. */
    activeLayer() {
        return this.layers.find(l => l.visible && l.type == 'polygon');
    }

    /** Remove a layer from the map. */
    removeLayer(layer: MapLayer) {
        this.hideLayer(layer);
        for (const f of layer.features) {
            f.setMap(null);
            f.unbindAll();
            google.maps.event.clearInstanceListeners(f);
        }
        this.layers = this.layers.filter(l => l !== layer);
    }

    /** Add a layer to the map. If a layer with the same name already exists, it will be replaced.
     * The layer will be hidden by default. */
    addLayer(options: MapLayerOptions, geojson: any): MapLayer {
        const labelPlacer = new PoleLabelPlacement(1); // 0.001 degrees precision

        const old = this.findLayer(options.name);
        if (old) {
            this.removeLayer(old);
        }

        const layer: MapLayer = {
            ...options,
            type: undefined,
            features: [],
            visible: false,
            selected: [],
            ids: [],
            bounds: new google.maps.LatLngBounds(),
        };

        // GeoJSON spec:
        // https://datatracker.ietf.org/doc/html/rfc7946
        for (const feature of geojson.features) {
            // Track the feature IDs so we can do a bulk data lookup
            layer.ids.push(feature.properties.id);

            if (feature.geometry.type == 'Polygon') {
                layer.type = 'polygon';

                // Polygons are an array of paths,
                // each path is an array of coordinates.
                // If a polygon has multiple paths, the first path is the outer ring and secondary paths
                // are typically holes that should follow the right-hand rule.
                const paths = feature.geometry.coordinates.map((c: any) => c.map((p: any) => new google.maps.LatLng(p[1], p[0])));
                for (const path of paths) {
                    for (const coord of path) {
                        layer.bounds.extend(coord);
                    }
                }

                const poly = new google.maps.Polygon({
                    ...this.defaultPolygonOptions,
                    paths: paths,
                });
                layer.features.push(poly);
                poly.set('props', feature.properties);

                // Add a label to the polygon if a label property is specified.
                if (options.label) {
                    const labelPos = labelPlacer.findPosition(poly);
                    let label = new MapLabel({
                        text: feature.properties[options.label],
                        position: labelPos,
                        minZoom: options.labelMinZoom || 15,
                    });
                    poly.set('label', label);
                }

                this.attachHandlers(poly, layer);
            }
            else if (feature.geometry.type == 'MultiPolygon') {
                layer.type = 'polygon';

                // Multi-polygons are an array of polygons,
                // each polygon is an array of paths,
                // each path is an array of coordinates.
                for (const _poly of feature.geometry.coordinates) {
                    const paths = _poly.map((c: any) => c.map((p: any) => new google.maps.LatLng(p[1], p[0])));
                    for (const path of paths) {
                        for (const coord of path) {
                            layer.bounds.extend(coord);
                        }
                    }

                    const poly = new google.maps.Polygon({
                        ...this.defaultPolygonOptions,
                        paths: paths,
                    });
                    layer.features.push(poly);
                    poly.set('props', feature.properties);

                    // Add a label to the polygon if a label property is specified.
                    if (options.label) {
                        const labelPos = labelPlacer.findPosition(poly);
                        let label = new MapLabel({
                            text: feature.properties[options.label],
                            position: labelPos,
                            minZoom: geojson.features.length > 10 ? 15 : 12,
                        });
                        poly.set('label', label);
                    }

                    this.attachHandlers(poly, layer);
                }

            }
            else if (feature.geometry.type == 'LineString') {
                layer.type = 'polyline';

                // LineStrings are a single path which is an array of coordinates.
                for (const _path of feature.geometry.coordinates) {
                    const path = _path.map((p: any) => new google.maps.LatLng(p[1], p[0]));
                    for (const point of path) {
                        layer.bounds.extend(point);
                    }

                    const line = new google.maps.Polyline({
                        ...this.defaultPolylineOptions,
                        path: path,
                    });
                    layer.features.push(line);
                }
            }
            else if (feature.geometry.type == 'MultiLineString') {
                layer.type = 'polyline';

                // MultiLineStrings are an array of LineStrings,
                // each LineString is an array of coordinates.
                for (const _line of feature.geometry.coordinates) {
                    for (const _path of _line) {
                        const path = _path.map((p: any) => new google.maps.LatLng(p[1], p[0]));
                        for (const point of path) {
                            layer.bounds.extend(point);
                        }

                        const line = new google.maps.Polyline({
                            ...this.defaultPolylineOptions,
                            path: path,
                        });
                        layer.features.push(line);
                    }
                }
            }
            else if (feature.geometry.type == 'Point') {
                layer.type = 'point';

                const marker = new google.maps.Marker({
                    position: new google.maps.LatLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]),
                });
                layer.features.push(marker);
            }
            else {
                console.error('Unsupported geometry type:', feature.geometry.type);
            }
        }


        this.layers.push(layer);
        return layer;
    }

    private attachHandlers(feature: google.maps.Polygon, layer: MapLayer) {

        feature.addListener('mouseover', () => {
            this.setHighlight(feature);
            //this.onMouseOver(feature.get('props'));
            if (layer.onMouseOver) {
                layer.onMouseOver(feature, feature.get('props'), layer);
            }
        });

        feature.addListener('mouseout', () => {
            if (!layer.selected.includes(feature))
                this.cancelHighlight(feature, layer);
            //this.onMouseOut(feature.get('props'));
            if (layer.onMouseOut) {
                layer.onMouseOut(feature, feature.get('props'), layer);
            }
        });

        feature.addListener('click', () => {
            //this.onClick(feature.get('props'));
            if (layer.onClick) {
                layer.onClick(feature, feature.get('props'), layer);
            }
        });

    }

    private setHighlight(feature: google.maps.Polygon) {
        const label = feature.get('label');
        feature.setOptions(this.defaultHighlightOptions);
        if (label) {
            label.setOptions({ strokeColor: this.defaultHighlightOptions.strokeColor });
        }
    }

    private cancelHighlight(feature: google.maps.Polygon, layer: MapLayer) {
        const label = feature.get('label');
        const props = feature.get('props');
        feature.setOptions(this.defaultPolygonOptions);
        if (layer.getStyle) {
            feature.setOptions(layer.getStyle(feature, props) as google.maps.PolygonOptions);
        }
        if (label) {
            label.setOptions({ strokeColor: '#ffffff' });
        }
    }

    /** Show a layer on the map. If the layer is a polygon, hide all other polygon layers. */
    showLayer(layer: MapLayer) {

        // Auto hide all other polygon layers to avoid visual clutter
        for (const l of this.layers) {
            if (l.type == 'polygon' && l.visible && l !== layer) {
                this.hideLayer(l);
            }
        }

        // Show all features
        for (const f of layer.features) {
            const props = f.get('props');
            if (layer.getStyle) {
                f.setOptions(layer.getStyle(f, props) as google.maps.PolygonOptions);
            }
            f.setMap(this.map);

            const label = f.get('label');
            if (label) {
                label.setMap(this.map);
            }
        }

        if (layer.type == 'polyline') {
            this.map.fitBounds(layer.bounds);
        }

        layer.visible = true;
    }

    /** Hide the active layer and the outline layer. */
    hideAllLayers() {
        for (const l of this.layers) {
            if (l.visible) {
                this.hideLayer(l);
            }
        }
    }

    /** Hide a layer by removing it from the map. */
    hideLayer(layer: MapLayer) {
        for (const f of layer.features) {
            f.setMap(null);

            const label = f.get('label');
            if (label) {
                label.setMap(null);
            }
        }
        layer.visible = false;
    }

    /** Refresh a layer by applying the styling function to each feature. */
    refreshLayer(layer: MapLayer) {
        for (const f of layer.features) {
            const props = f.get('props');
            if (layer.getStyle) {
                f.setOptions(layer.getStyle(f, props) as google.maps.PolygonOptions);
            }
        }
    }

    /** Attach bounds_changed handlers to keep navigation synchronized for other instances in the same window */
    private attachBoundsChangedHandlers() {
        const locEventName = 'map-bounds-changed';
        let locMouseOver = false;
        let locTimer = 0;
        // Keep track of the mouse so that we don't trigger events in a loop on our own instance
        this.map.addListener('drag', () => { locMouseOver = true; });
        this.map.addListener('mouseover', () => { locMouseOver = true; });
        this.map.addListener('mouseout', () => { locMouseOver = false; });
        this.map.addListener('bounds_changed', () => {
            if (locMouseOver) {
                const zoom = this.map.getZoom();
                const center = this.map.getCenter();
                window.clearTimeout(locTimer);
                lastLocation = { zoom, center };
                // Debounce needed because of potential fast invocations when dragging
                locTimer = setTimeout(() => {
                    this.onBoundsChanged();
                    window.dispatchEvent(new CustomEvent(locEventName, { detail: { zoom, center } }));
                }, 100);
            }
        });
        // Move the map when another instance has sent us bounds_changed event
        const boundsHandler = (e: any) => {
            // Window event may call this after disposal
            if (this.map === null) {
                window.removeEventListener(locEventName, boundsHandler);
                return;
            }
            if (!locMouseOver) {
                this.map.setCenter(e.detail.center);
                this.map.setZoom(e.detail.zoom);
            }
        }
        window.addEventListener(locEventName, boundsHandler);
    }

    getCenter(): google.maps.LatLng {
        return this.map.getCenter()!;
    }

    getZoom(): number {
        return this.map.getZoom()!;
    }

    getBounds(): google.maps.LatLngBounds {
        return this.map.getBounds()!;
    }

    /** Calculate the center point of a polygon. */
    private getPolygonCenter(polygon: google.maps.Polygon): google.maps.LatLng {
        const bounds = new google.maps.LatLngBounds();
        polygon.getPaths().getAt(0).forEach(point => bounds.extend(point));
        return bounds.getCenter();
    }

}
