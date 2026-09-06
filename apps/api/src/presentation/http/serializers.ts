import type {
  TrackFeature,
  VesselSnapshot,
  WorkerControl,
} from "../../domain/models.ts";

export interface VesselSnapshotResponse {
  mmsi: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  rot: number | null;
  nav_status: string | null;
  vessel_class: "A" | "B";
  ship_name: string | null;
  ship_type: number | null;
  call_sign: string | null;
  imo: string | null;
  destination: string | null;
}

export interface WorkerControlResponse {
  is_enabled: boolean;
  worker_state: "running" | "stopped";
  updated_at: string;
  last_heartbeat: string | null;
}

export function toVesselSnapshotResponse(
  vessel: VesselSnapshot,
): VesselSnapshotResponse {
  return {
    mmsi: vessel.mmsi,
    timestamp: vessel.timestamp,
    latitude: vessel.latitude,
    longitude: vessel.longitude,
    sog: vessel.sog,
    cog: vessel.cog,
    heading: vessel.heading,
    rot: vessel.rot,
    nav_status: vessel.navigationStatus,
    vessel_class: vessel.vesselClass,
    ship_name: vessel.shipName,
    ship_type: vessel.shipType,
    call_sign: vessel.callSign,
    imo: vessel.imo,
    destination: vessel.destination,
  };
}

export function toVesselSnapshotResponses(
  vessels: VesselSnapshot[],
): VesselSnapshotResponse[] {
  return vessels.map(toVesselSnapshotResponse);
}

export function toWorkerControlResponse(
  workerControl: WorkerControl,
): WorkerControlResponse {
  return {
    is_enabled: workerControl.isEnabled,
    worker_state: workerControl.workerState,
    updated_at: workerControl.updatedAt,
    last_heartbeat: workerControl.lastHeartbeat,
  };
}

export function toTrackResponse(track: TrackFeature): TrackFeature {
  return track;
}
