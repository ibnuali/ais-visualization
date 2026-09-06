import type { TrackFeature, VesselSnapshot } from "../domain/models.ts";
import type { VesselSnapshotReader } from "./ports.ts";

export const DEFAULT_TRACK_HOURS = 24;
export const MAX_TRACK_HOURS = 168;

export interface VesselQueries {
  getLatestVesselPositions(): Promise<VesselSnapshot[]>;
  getVesselTrack(mmsi: number, hours: number): Promise<TrackFeature>;
}

export function createVesselQueries(
  vesselSnapshotReader: VesselSnapshotReader,
): VesselQueries {
  return {
    getLatestVesselPositions: () =>
      vesselSnapshotReader.getLatestVesselPositions(),
    getVesselTrack: (mmsi, hours) =>
      vesselSnapshotReader.getVesselTrack(mmsi, hours),
  };
}
