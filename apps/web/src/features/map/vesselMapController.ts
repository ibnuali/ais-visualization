import { LngLatBounds } from "maplibre-gl";
import type {
  FilterSpecification,
  GeoJSONFeatureDiff,
  Map as MapLibreMap,
} from "maplibre-gl";
import type {
  Coordinate,
  PlaybackPosition,
  TrackFeature,
  VesselRecord,
} from "../../types.ts";
import {
  getPlaybackFeatureCollection,
  getTrackLine,
  getVesselFeature,
  getVesselFeatureCollection,
  hasVesselPosition,
  shouldUpdateVesselFeature,
  type VesselFeature,
  type VesselFeatureCollection,
} from "./vesselMapData.ts";
import { getTrackCoordinates } from "./utils.ts";
import { MAP_LAYER_IDS, MAP_SOURCE_IDS } from "./vesselMapConfig.ts";
import { addMapLayers, getGeoJsonSource } from "./vesselMapLayers.ts";

export interface VesselMapController {
  initialize: (vessels: readonly VesselRecord[]) => void;
  replaceVessels: (vessels: VesselRecord[]) => void;
  updateVessels: (vessels: VesselRecord[]) => void;
  setSelectedMmsi: (selectedMmsi: string | number | null | undefined) => void;
  setTrack: (trackGeoJson: TrackFeature | null) => void;
  setPlayback: (playbackPosition: PlaybackPosition | null) => void;
  fitAllVessels: (vessels: readonly VesselRecord[]) => boolean;
  fitTrack: (trackGeoJson: TrackFeature | null) => boolean;
  dispose: () => void;
}

function cacheVesselFeatures(
  vesselData: VesselFeatureCollection,
): Map<string, VesselFeature> {
  return new Map(vesselData.features.map((feature) => [feature.id, feature]));
}

function fitMapToCoordinates(
  map: MapLibreMap,
  coordinates: Coordinate[],
  padding: { top: number; right: number; bottom: number; left: number },
  maxZoom: number,
): boolean {
  if (coordinates.length === 0) {
    return false;
  }

  const bounds = new LngLatBounds(coordinates[0], coordinates[0]);
  coordinates.slice(1).forEach((coordinate) => bounds.extend(coordinate));
  map.fitBounds(bounds, { padding, maxZoom, duration: 600 });
  return true;
}

function getVesselCoordinates(vessels: readonly VesselRecord[]): Coordinate[] {
  return vessels
    .filter(hasVesselPosition)
    .map(
      (vessel): Coordinate => [
        Number(vessel.longitude),
        Number(vessel.latitude),
      ],
    );
}

export function createVesselMapController(
  map: MapLibreMap,
): VesselMapController {
  let vesselFeatures = new Map<string, VesselFeature>();
  let isDisposed = false;

  const initialize = (vessels: readonly VesselRecord[]): void => {
    if (isDisposed) {
      return;
    }

    const vesselData = getVesselFeatureCollection(vessels);
    vesselFeatures = cacheVesselFeatures(vesselData);
    addMapLayers(map, vesselData);
  };

  const replaceVessels = (nextVessels: VesselRecord[]): void => {
    if (isDisposed) {
      return;
    }

    const vesselData = getVesselFeatureCollection(nextVessels);
    vesselFeatures = cacheVesselFeatures(vesselData);

    const source = getGeoJsonSource(map, MAP_SOURCE_IDS.vessels);
    if (source) {
      void source.setData(vesselData);
    }
  };

  const updateVessels = (updatedVessels: VesselRecord[]): void => {
    if (isDisposed) {
      return;
    }

    const source = getGeoJsonSource(map, MAP_SOURCE_IDS.vessels);
    if (!source) {
      return;
    }

    const add: VesselFeature[] = [];
    const update: GeoJSONFeatureDiff[] = [];

    updatedVessels.filter(hasVesselPosition).forEach((vessel) => {
      const feature = getVesselFeature(vessel);
      const existingFeature = vesselFeatures.get(feature.id);

      if (!shouldUpdateVesselFeature(map, existingFeature, feature)) {
        return;
      }

      vesselFeatures.set(feature.id, feature);
      if (existingFeature) {
        update.push({
          id: feature.id,
          newGeometry: feature.geometry,
          addOrUpdateProperties: Object.entries(feature.properties).map(
            ([key, value]) => ({ key, value }),
          ),
        });
      } else {
        add.push(feature);
      }
    });

    if (add.length === 0 && update.length === 0) {
      return;
    }

    void source.updateData({ add, update });
  };

  const setSelectedMmsi = (
    selectedMmsi: string | number | null | undefined,
  ): void => {
    if (isDisposed || !map.getLayer(MAP_LAYER_IDS.selection)) {
      return;
    }

    const selectedFilter: FilterSpecification =
      selectedMmsi !== null && selectedMmsi !== undefined
        ? ["==", ["get", "mmsi"], String(selectedMmsi)]
        : ["==", ["get", "mmsi"], "__none__"];
    map.setFilter(MAP_LAYER_IDS.selection, selectedFilter);
  };

  const setTrack = (trackGeoJson: TrackFeature | null): void => {
    if (isDisposed) {
      return;
    }

    const source = getGeoJsonSource(map, MAP_SOURCE_IDS.track);
    void source?.setData(getTrackLine(trackGeoJson));
  };

  const setPlayback = (playbackPosition: PlaybackPosition | null): void => {
    if (isDisposed) {
      return;
    }

    const source = getGeoJsonSource(map, MAP_SOURCE_IDS.playback);
    void source?.setData(getPlaybackFeatureCollection(playbackPosition));
  };

  const fitAllVessels = (vessels: readonly VesselRecord[]): boolean => {
    if (isDisposed) {
      return false;
    }

    return fitMapToCoordinates(
      map,
      getVesselCoordinates(vessels),
      { top: 112, right: 64, bottom: 112, left: 64 },
      10,
    );
  };

  const fitTrack = (trackGeoJson: TrackFeature | null): boolean => {
    if (isDisposed) {
      return false;
    }

    const coordinates = getTrackCoordinates(trackGeoJson);

    if (coordinates.length === 0) {
      return false;
    }

    if (coordinates.length === 1) {
      map.easeTo({
        center: coordinates[0],
        zoom: Math.max(map.getZoom(), 10),
        duration: 600,
      });
      return true;
    }

    return fitMapToCoordinates(
      map,
      coordinates,
      { top: 160, right: 64, bottom: 160, left: 64 },
      12,
    );
  };

  return {
    initialize,
    replaceVessels,
    updateVessels,
    setSelectedMmsi,
    setTrack,
    setPlayback,
    fitAllVessels,
    fitTrack,
    dispose: () => {
      isDisposed = true;
      vesselFeatures.clear();
    },
  };
}
