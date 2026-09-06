export type VesselClass = "A" | "B";
export type WorkerState = "running" | "stopped";

export interface PositionReport {
  timestamp: string;
  mmsi: number;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  rot: number | null;
  navStatus: string | null;
  vesselClass: VesselClass;
}

export interface ShipStaticData {
  mmsi: number;
  shipName?: string | null;
  shipType?: number | null;
  callSign?: string | null;
  imo?: number | string | null;
  destination?: string | null;
  dimBow?: number | null;
  dimStern?: number | null;
  dimPort?: number | null;
  dimStarboard?: number | null;
}

export interface VesselSnapshot {
  mmsi: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  rot: number | null;
  navigationStatus: string | null;
  vesselClass: VesselClass;
  shipName: string | null;
  shipType: number | null;
  callSign: string | null;
  imo: string | null;
  destination: string | null;
}

export interface WorkerControl {
  isEnabled: boolean;
  workerState: WorkerState;
  updatedAt: string;
  lastHeartbeat: string | null;
}

export interface TrackFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
  properties: {
    timestamps: string[];
    headings: Array<number | null>;
  };
}
