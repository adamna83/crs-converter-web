// map.js — MapLibre GL map setup, marker management, and batch point layer.

import { Map, Marker } from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre v6 ships its worker as a separate ESM module. Without this the
// worker URL resolves to index.html (SPA fallback) and the map never paints.
setWorkerUrl(maplibreWorkerUrl);

/** @type {Map} */
export let map;

const markers = [];

const BATCH_SOURCE = 'batch-points';
const BATCH_LAYER = 'batch-circles';

function buildStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };
}

/** Initialise the map once the DOM is ready. */
export function initMap() {
  map = new Map({
    container: 'map',
    style: buildStyle(),
    center: [104.5, 5.0],
    zoom: 6,
  });

  map.on('load', () => {
    map.addSource(BATCH_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: BATCH_LAYER,
      type: 'circle',
      source: BATCH_SOURCE,
      paint: {
        'circle-color': '#ef4444',
        'circle-radius': 5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    });
  });

  return map;
}

/** Remove all previously plotted markers. */
function clearMarkers() {
  while (markers.length) {
    markers.pop().remove();
  }
}

/** Plot a single point marker (color-coded). */
export function plotMarker(lon, lat, color) {
  if (!map || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
  const el = document.createElement('div');
  el.className = 'map-marker';
  el.style.background = color;
  el.style.border = '2px solid #fff';
  el.style.borderRadius = '50%';
  el.style.width = '12px';
  el.style.height = '12px';
  el.style.boxShadow = '0 0 4px rgba(0,0,0,0.6)';
  markers.push(new Marker({ element: el }).setLngLat([lon, lat]).addTo(map));
}

/** Plot the source + target markers, clearing previous single-point markers. */
export function plotSingle(sourceWgs84, targetWgs84) {
  clearMarkers();
  plotMarker(sourceWgs84.lon, sourceWgs84.lat, '#22c55e');
  plotMarker(targetWgs84.lon, targetWgs84.lat, '#f59e0b');
  const pts = [sourceWgs84, targetWgs84].filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  if (pts.length) {
    map.fitBounds(
      [
        [Math.min(...pts.map((p) => p.lon)), Math.min(...pts.map((p) => p.lat))],
        [Math.max(...pts.map((p) => p.lon)), Math.max(...pts.map((p) => p.lat))],
      ],
      { padding: 60, maxZoom: 14 }
    );
  }
}

/** Plot a batch of transformed points as a scatter layer. */
export function plotBatch(points) {
  if (!map || !map.isStyleLoaded()) return;
  const ok = points.filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
  const features = ok.map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { id: String(p.id) },
  }));
  const src = map.getSource(BATCH_SOURCE);
  if (src) src.setData({ type: 'FeatureCollection', features });

  if (features.length) {
    map.fitBounds(
      [
        [Math.min(...ok.map((p) => p.lon)), Math.min(...ok.map((p) => p.lat))],
        [Math.max(...ok.map((p) => p.lon)), Math.max(...ok.map((p) => p.lat))],
      ],
      { padding: 60, maxZoom: 12 }
    );
  }
}
