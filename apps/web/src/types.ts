import type { ReactElement } from "react";

export type NumericValue = number | null | undefined;

export interface VesselRecord {
  mmsi: string | number;
  timestamp?: string | null;
  latitude?: NumericValue;
  longitude?: NumericValue;
  sog?: NumericValue;
  cog?: NumericValue;
  heading?: NumericValue;
  rot?: NumericValue;
  nav_status?: string | null;
  vessel_class?: string | null;
  ship_name?: string | null;
  ship_type?: number | null;
  call_sign?: string | null;
  imo?: string | null;
  destination?: string | null;
}

export type VesselRecordInput = Partial<Omit<VesselRecord, "mmsi">> & {
  mmsi: string | number;
};

export type VesselRecordMap = Record<string, VesselRecord>;

export type Coordinate = [number, number];

export interface TrackProperties {
  timestamps: Array<string | null>;
  headings: Array<number | null>;
  sogs: Array<number | null>;
  cogs: Array<number | null>;
  nav_statuses: Array<string | null>;
}

export interface TrackFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: Coordinate[];
  };
  properties: TrackProperties;
}

export interface PlaybackPosition {
  longitude: number;
  latitude: number;
  heading: number;
  sog: number | null;
  cog: number | null;
  navStatus: string | null;
  timestamp: string | null;
}

export type TrackStatus = "idle" | "loading" | "ready" | "error";

export interface TrackState {
  status: TrackStatus;
  data: TrackFeature | null;
  points: number;
  error: string;
}

export type DataState = "connecting" | "connected" | "stopped" | "error";
export type StatusTone = DataState | "idle";

export interface StatusCopy {
  label: string;
  detail: string;
}

export interface EmptyState {
  kicker: string;
  title: string;
  detail: string;
}

export type ActivityType = "info" | "success" | "warning" | "error" | "result";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timestamp: string;
}

export type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "close"
  | "command"
  | "locate"
  | "pause"
  | "play"
  | "refresh"
  | "route"
  | "search"
  | "trash";

export interface Command {
  id: string;
  label: string;
  detail: string;
  icon: IconName;
  disabled?: boolean;
  run: () => void;
}

export interface MapControls {
  fitAllVessels: () => boolean;
  fitTrack: (trackGeoJson: TrackFeature | null) => boolean;
  replaceVessels: (vessels: VesselRecord[]) => void;
  updateVessels: (vessels: VesselRecord[]) => void;
}

export interface WorkerControl {
  worker_id: string;
  region: string;
  region_description: string;
  is_enabled: boolean;
  worker_state: "running" | "stopped";
  updated_at: string | null;
  last_heartbeat: string | null;
}

export interface WorkerControlsResponse {
  workers: WorkerControl[];
  control_configured: boolean;
}

export type WorkerAction = "start" | "stop";
export type WorkerSummaryTone = "connecting" | "connected" | "idle" | "error";

export interface WorkerSummary {
  label: string;
  detail: string;
  tone: WorkerSummaryTone;
}

export interface MockVessel extends VesselRecord {
  mmsi: number;
  latitude: number;
  longitude: number;
  heading: number;
  sog: number;
  cog: number;
  vessel_class: "A" | "B";
  nav_status: string;
  ship_name: string;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
}

export interface PrototypeVariantProps {
  vessels: MockVessel[];
  selectedMmsi: number | null;
  onSelectVessel: (mmsi: number | null) => void;
}

export type VariantKey = "A" | "B" | "C";

export interface PrototypeVariant {
  key: VariantKey;
  label: string;
  Component: (props: PrototypeVariantProps) => ReactElement;
}
