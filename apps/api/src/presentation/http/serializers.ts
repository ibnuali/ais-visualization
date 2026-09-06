import type {
  TrackFeature,
  VesselSnapshot,
  WorkerControl,
} from "../../domain/models.ts";
import { getWorkerRegion } from "../../domain/worker-regions.ts";

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
  worker_id: string;
  region: string;
  region_description: string;
  is_enabled: boolean;
  worker_state: "running" | "stopped";
  updated_at: string;
  last_heartbeat: string | null;
}

export interface WorkerAggregateResponse {
  is_enabled: boolean;
  worker_state: "running" | "stopped";
  updated_at: string;
  last_heartbeat: string | null;
  control_configured: boolean;
  workers: WorkerControlResponse[];
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
  const workerRegion = getWorkerRegion(workerControl.workerId);

  return {
    worker_id: workerControl.workerId,
    region: workerRegion.name,
    region_description: workerRegion.description,
    is_enabled: workerControl.isEnabled,
    worker_state: workerControl.workerState,
    updated_at: workerControl.updatedAt,
    last_heartbeat: workerControl.lastHeartbeat,
  };
}

export function toWorkerControlResponses(
  workerControls: WorkerControl[],
): WorkerControlResponse[] {
  return workerControls.map(toWorkerControlResponse);
}

export function toWorkerAggregateResponse(
  workerControls: WorkerControl[],
  controlConfigured: boolean,
): WorkerAggregateResponse {
  const updatedAt = workerControls
    .map(({ updatedAt: timestamp }) => timestamp)
    .sort()
    .at(-1);
  const heartbeatValues = workerControls.map(
    ({ lastHeartbeat }) => lastHeartbeat,
  );

  return {
    is_enabled:
      workerControls.length > 0 &&
      workerControls.every(({ isEnabled }) => isEnabled),
    worker_state:
      workerControls.length > 0 &&
      workerControls.every(({ workerState }) => workerState === "running")
        ? "running"
        : "stopped",
    updated_at: updatedAt ?? new Date(0).toISOString(),
    last_heartbeat: heartbeatValues.some((heartbeat) => heartbeat === null)
      ? null
      : (heartbeatValues.sort()[0] ?? null),
    control_configured: controlConfigured,
    workers: toWorkerControlResponses(workerControls),
  };
}

export function toTrackResponse(track: TrackFeature): TrackFeature {
  return track;
}
