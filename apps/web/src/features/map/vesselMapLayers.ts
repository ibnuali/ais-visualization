import { GeoJSONSource } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  EMPTY_FEATURE_COLLECTION,
  type VesselFeatureCollection,
} from "./vesselMapData.ts";
import {
  MAP_LAYER_IDS,
  MAP_SOURCE_IDS,
  VESSEL_DETAIL_ZOOM,
} from "./vesselMapConfig.ts";

export function addMapLayers(
  map: MapLibreMap,
  vesselData: VesselFeatureCollection,
): void {
  map.addSource(MAP_SOURCE_IDS.vessels, {
    type: "geojson",
    data: vesselData,
  });

  map.addSource(MAP_SOURCE_IDS.track, {
    type: "geojson",
    data: EMPTY_FEATURE_COLLECTION,
  });

  map.addLayer({
    id: MAP_LAYER_IDS.track,
    type: "line",
    source: MAP_SOURCE_IDS.track,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#2563eb",
      "line-width": 4,
      "line-opacity": 0.9,
    },
  });

  map.addSource(MAP_SOURCE_IDS.playback, {
    type: "geojson",
    data: EMPTY_FEATURE_COLLECTION,
  });

  map.addLayer({
    id: MAP_LAYER_IDS.overview,
    type: "circle",
    source: MAP_SOURCE_IDS.vessels,
    maxzoom: VESSEL_DETAIL_ZOOM,
    paint: {
      "circle-color": "#e34d61",
      "circle-opacity": 0.85,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        1.5,
        VESSEL_DETAIL_ZOOM,
        4,
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 0.75,
    },
  });

  map.addLayer({
    id: MAP_LAYER_IDS.selection,
    type: "circle",
    source: MAP_SOURCE_IDS.vessels,
    filter: ["==", ["get", "mmsi"], "__none__"],
    paint: {
      "circle-color": "#ffffff",
      "circle-opacity": 0.15,
      "circle-radius": 14,
      "circle-stroke-color": "#2563eb",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: MAP_LAYER_IDS.vessels,
    type: "symbol",
    source: MAP_SOURCE_IDS.vessels,
    minzoom: VESSEL_DETAIL_ZOOM,
    layout: {
      "icon-image": "vessel",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.55,
        8,
        0.85,
        14,
        1.1,
      ],
      "icon-rotate": ["get", "heading"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  map.addLayer({
    id: MAP_LAYER_IDS.playbackHalo,
    type: "circle",
    source: MAP_SOURCE_IDS.playback,
    paint: {
      "circle-color": "#f59e0b",
      "circle-opacity": 0.2,
      "circle-radius": 14,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  });

  map.addLayer({
    id: MAP_LAYER_IDS.playbackPoint,
    type: "circle",
    source: MAP_SOURCE_IDS.playback,
    paint: {
      "circle-color": "#f59e0b",
      "circle-radius": 6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

export function getGeoJsonSource(
  map: MapLibreMap | null,
  sourceId: string,
): GeoJSONSource | null {
  const source = map?.getSource(sourceId);
  return source instanceof GeoJSONSource ? source : null;
}
