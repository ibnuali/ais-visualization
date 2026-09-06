import type { WorkerControl, WorkerId } from "../domain/models.ts";
import type { WorkerControlStore } from "./ports.ts";

export interface WorkerControls {
  getStatuses(): Promise<WorkerControl[]>;
  enable(workerId: WorkerId): Promise<WorkerControl>;
  disable(workerId: WorkerId): Promise<WorkerControl>;
  setAllEnabled(isEnabled: boolean): Promise<void>;
}

export function createWorkerControls(
  workerControlStore: WorkerControlStore,
): WorkerControls {
  return {
    getStatuses: () => workerControlStore.getWorkerControls(),
    enable: (workerId) => workerControlStore.setWorkerEnabled(workerId, true),
    disable: (workerId) => workerControlStore.setWorkerEnabled(workerId, false),
    setAllEnabled: (isEnabled) =>
      workerControlStore.setAllWorkerEnabled(isEnabled),
  };
}
