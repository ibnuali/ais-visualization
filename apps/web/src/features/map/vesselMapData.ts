import type { Map as MapLibreMap } from "maplibre-gl";
import type {
  Coordinate,
  PlaybackPosition,
  TrackFeature,
  VesselRecord,
} from "../../types.ts";
import { getTrackCoordinates } from "./utils.ts";
import {
  MIN_VESSEL_HEADING_CHANGE_DEGREES,
  MIN_VESSEL_UPDATE_DISTANCE_PX,
  VESSEL_DETAIL_ZOOM,
} from "./vesselMapConfig.ts";

export type EmptyFeatureCollection = {
  type: "FeatureCollection";
  features: [];
};

export type VesselFeatureProperties = {
  mmsi: string;
  heading: number;
};

export type VesselFeature = {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: Coordinate;
  };
  properties: VesselFeatureProperties;
};

export type VesselFeatureCollection = {
  type: "FeatureCollection";
  features: VesselFeature[];
};

export type TrackLineFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "LineString";
      coordinates: Coordinate[];
    };
    properties: Record<string, never>;
  }>;
};

export type PlaybackFeatureProperties = {
  heading: number;
};

export type PlaybackFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: Coordinate;
    };
    properties: PlaybackFeatureProperties;
  }>;
};

export const EMPTY_FEATURE_COLLECTION: EmptyFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function hasVesselPosition(vessel: VesselRecord): boolean {
  return (
    vessel.mmsi !== undefined &&
    vessel.mmsi !== null &&
    Number.isFinite(Number(vessel.latitude)) &&
    Number.isFinite(Number(vessel.longitude))
  );
}

export function getVesselFeature(vessel: VesselRecord): VesselFeature {
  const mmsi = String(vessel.mmsi);

  return {
    type: "Feature",
    id: mmsi,
    geometry: {
      type: "Point",
      coordinates: [Number(vessel.longitude), Number(vessel.latitude)],
    },
    properties: {
      mmsi,
      heading: Number.isFinite(Number(vessel.heading))
        ? Number(vessel.heading)
        : 0,
    },
  };
}

export function getVesselFeatureCollection(
  vessels: readonly VesselRecord[],
): VesselFeatureCollection {
  return {
    type: "FeatureCollection",
    features: vessels.filter(hasVesselPosition).map(getVesselFeature),
  };
}

export function shouldUpdateVesselFeature(
  map: MapLibreMap,
  existingFeature: VesselFeature | undefined,
  nextFeature: VesselFeature,
): boolean {
  if (!existingFeature) {
    return true;
  }

  const existingPoint = map.project(existingFeature.geometry.coordinates);
  const nextPoint = map.project(nextFeature.geometry.coordinates);
  const pixelDistance = Math.hypot(
    nextPoint.x - existingPoint.x,
    nextPoint.y - existingPoint.y,
  );

  if (pixelDistance >= MIN_VESSEL_UPDATE_DISTANCE_PX) {
    return true;
  }

  if (map.getZoom() < VESSEL_DETAIL_ZOOM) {
    return false;
  }

  const existingHeading = Number(existingFeature.properties.heading) || 0;
  const nextHeading = Number(nextFeature.properties.heading) || 0;
  const headingDifference = Math.abs(nextHeading - existingHeading) % 360;

  return (
    Math.min(headingDifference, 360 - headingDifference) >=
    MIN_VESSEL_HEADING_CHANGE_DEGREES
  );
}

export function getTrackLine(
  trackGeoJson: TrackFeature | null,
): TrackLineFeatureCollection | EmptyFeatureCollection {
  const coordinates = getTrackCoordinates(trackGeoJson);

  if (coordinates.length < 2) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {},
      },
    ],
  };
}

export function getPlaybackFeatureCollection(
  playbackPosition: PlaybackPosition | null,
): PlaybackFeatureCollection | EmptyFeatureCollection {
  if (
    !playbackPosition ||
    !Number.isFinite(Number(playbackPosition.longitude)) ||
    !Number.isFinite(Number(playbackPosition.latitude))
  ) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            Number(playbackPosition.longitude),
            Number(playbackPosition.latitude),
          ],
        },
        properties: {
          heading: Number.isFinite(Number(playbackPosition.heading))
            ? Number(playbackPosition.heading)
            : 0,
        },
      },
    ],
  };
}
