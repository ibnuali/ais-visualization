import type {
  ActivityEvent,
  ActivityType,
  Coordinate,
  DataState,
  EmptyState,
  NumericValue,
  PlaybackPosition,
  TrackFeature,
  VesselRecord,
  VesselRecordInput,
  VesselRecordMap,
} from "../../types.ts";

const LOG_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

let activitySequence = 0;

type UnknownObject = Record<string, unknown>;

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null;
}

function isVesselRecordInput(value: unknown): value is VesselRecordInput {
  return (
    isObject(value) &&
    (typeof value.mmsi === "string" || typeof value.mmsi === "number")
  );
}

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}

export function createActivityEvent(
  type: ActivityType,
  title: string,
  detail: string,
): ActivityEvent {
  return {
    id: `activity-${Date.now()}-${activitySequence++}`,
    type,
    title,
    detail,
    timestamp: new Date().toISOString(),
  };
}

function isOlderPosition(
  existingRecord: VesselRecord | undefined,
  incomingRecord: VesselRecordInput,
): boolean {
  const incomingTime =
    typeof incomingRecord.timestamp === "string"
      ? Date.parse(incomingRecord.timestamp)
      : NaN;
  const existingTime = existingRecord?.timestamp
    ? Date.parse(existingRecord.timestamp)
    : NaN;

  return (
    incomingRecord.latitude !== undefined &&
    Number.isFinite(incomingTime) &&
    Number.isFinite(existingTime) &&
    incomingTime < existingTime
  );
}

function mergeVesselRecords(
  currentRecords: VesselRecordMap,
  records: readonly unknown[],
): VesselRecordMap {
  const nextRecords = { ...currentRecords };

  records.forEach((record) => {
    if (!isVesselRecordInput(record)) {
      return;
    }

    const key = String(record.mmsi);
    const existingRecord = nextRecords[key];

    if (isOlderPosition(existingRecord, record)) {
      return;
    }

    nextRecords[key] = {
      ...existingRecord,
      ...record,
      mmsi: key,
    };
  });

  return nextRecords;
}

export function recordsFromSnapshot(records: unknown): VesselRecordMap {
  return mergeVesselRecords({}, Array.isArray(records) ? records : []);
}

export function sortVessels(records: VesselRecordMap): VesselRecord[] {
  return Object.values(records)
    .filter(
      (record) =>
        Number.isFinite(Number(record.latitude)) &&
        Number.isFinite(Number(record.longitude)),
    )
    .sort((left, right) =>
      String(left.mmsi).localeCompare(String(right.mmsi), undefined, {
        numeric: true,
      }),
    );
}

export function getTrackCoordinates(track: unknown): Coordinate[] {
  if (!isObject(track) || track.type !== "Feature") {
    return [];
  }

  const geometry = track.geometry;
  if (!isObject(geometry) || geometry.type !== "LineString") {
    return [];
  }

  return Array.isArray(geometry.coordinates)
    ? geometry.coordinates
        .filter(isCoordinate)
        .map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])])
    : [];
}

export function isTrackFeature(track: unknown): track is TrackFeature {
  if (!isObject(track) || track.type !== "Feature") {
    return false;
  }

  const geometry = track.geometry;
  const properties = track.properties;
  if (
    !isObject(geometry) ||
    geometry.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    !isObject(properties) ||
    !Array.isArray(properties.timestamps) ||
    !Array.isArray(properties.headings) ||
    !Array.isArray(properties.sogs) ||
    !Array.isArray(properties.cogs) ||
    !Array.isArray(properties.nav_statuses)
  ) {
    return false;
  }

  return (
    geometry.coordinates.every(isCoordinate) &&
    properties.timestamps.every(
      (timestamp): timestamp is string | null =>
        timestamp === null || typeof timestamp === "string",
    ) &&
    properties.headings.every(isNullableNumber) &&
    properties.sogs.every(isNullableNumber) &&
    properties.cogs.every(isNullableNumber) &&
    properties.nav_statuses.every(
      (status): status is string | null =>
        status === null || typeof status === "string",
    ) &&
    properties.timestamps.length === geometry.coordinates.length &&
    properties.headings.length === geometry.coordinates.length &&
    properties.sogs.length === geometry.coordinates.length &&
    properties.cogs.length === geometry.coordinates.length &&
    properties.nav_statuses.length === geometry.coordinates.length
  );
}

export function getTrackPlaybackPosition(
  track: TrackFeature | null,
  index: number,
): PlaybackPosition | null {
  if (!track) {
    return null;
  }

  const coordinates = track.geometry.coordinates[index];
  if (!coordinates || !isCoordinate(coordinates)) {
    return null;
  }

  const heading = track.properties.headings[index];
  const sog = track.properties.sogs[index];
  const cog = track.properties.cogs[index];
  const navStatus = track.properties.nav_statuses[index];

  return {
    longitude: Number(coordinates[0]),
    latitude: Number(coordinates[1]),
    heading: heading ?? 0,
    sog: sog ?? null,
    cog: cog ?? null,
    navStatus: navStatus ?? null,
    timestamp: track.properties.timestamps[index] || null,
  };
}

export function getEmptyState(dataState: DataState): EmptyState {
  if (dataState === "connecting") {
    return {
      kicker: "LOADING SNAPSHOT",
      title: "Reading vessel positions",
      detail: "The map is loading the latest positions stored in PostgreSQL.",
    };
  }

  if (dataState === "stopped") {
    return {
      kicker: "WORKER STOPPED",
      title: "Vessel polling is paused",
      detail:
        "Start the background worker to resume database snapshot updates.",
    };
  }

  if (dataState === "error") {
    return {
      kicker: "SNAPSHOT UNAVAILABLE",
      title: "The map cannot reach the API",
      detail:
        "The background worker continues independently. Try refreshing the database snapshot.",
    };
  }

  return {
    kicker: "NO TRAFFIC",
    title: "No vessels in the tracking area",
    detail: "The worker has not stored a current vessel position yet.",
  };
}

export function formatNumber(value: NumericValue | string, digits = 1): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

export function formatTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : LOG_TIME_FORMATTER.format(date);
}
