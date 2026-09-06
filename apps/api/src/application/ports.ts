import type {
  PositionReport,
  ShipStaticData,
  TrackFeature,
  VesselSnapshot,
  WorkerControl,
  WorkerState,
} from "../domain/models.ts";

export type AsyncHandler<T> = (value: T) => unknown | Promise<unknown>;

export interface VesselSnapshotReader {
  getLatestVesselPositions(): Promise<VesselSnapshot[]>;
  getVesselTrack(mmsi: number, hours: number): Promise<TrackFeature>;
}

export interface WorkerControlStore {
  getWorkerControl(): Promise<WorkerControl>;
  setWorkerEnabled(isEnabled: boolean): Promise<WorkerControl>;
  setWorkerState(workerState: WorkerState): Promise<WorkerControl>;
}

export interface VesselDataWriter {
  storePosition(position: PositionReport): Promise<void>;
  storeShipStaticData(data: ShipStaticData): Promise<void>;
}

export interface Ingestion {
  stop(): void;
}

export interface IngestionOptions {
  apiKey: string;
  onPosition: AsyncHandler<PositionReport>;
  onMetadata: AsyncHandler<ShipStaticData>;
}

export type CreateIngestion = (options: IngestionOptions) => Ingestion;

export interface Logger {
  error(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn?(message: string, ...details: unknown[]): void;
}
