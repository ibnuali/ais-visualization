import type { WorkerControl } from "../domain/models.ts";
import type { WorkerControlStore } from "./ports.ts";

export interface WorkerControls {
  getStatus(): Promise<WorkerControl>;
  enable(): Promise<WorkerControl>;
  disable(): Promise<WorkerControl>;
}

export function createWorkerControls(
  workerControlStore: WorkerControlStore,
): WorkerControls {
  return {
    getStatus: () => workerControlStore.getWorkerControl(),
    enable: () => workerControlStore.setWorkerEnabled(true),
    disable: () => workerControlStore.setWorkerEnabled(false),
  };
}
