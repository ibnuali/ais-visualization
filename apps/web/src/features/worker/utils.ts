import type { WorkerControl, WorkerSummary } from "../../types.ts";
import { WORKER_HEARTBEAT_TIMEOUT_MS } from "./constants.ts";

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not reported yet";
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? "Not reported yet"
    : timestamp.toLocaleString();
}

function hasCurrentHeartbeat(lastHeartbeat: string | null): boolean {
  const heartbeatTime = Date.parse(lastHeartbeat ?? "");
  return (
    Number.isFinite(heartbeatTime) &&
    Date.now() - heartbeatTime <= WORKER_HEARTBEAT_TIMEOUT_MS
  );
}

export function getWorkerSummary(worker: WorkerControl | null): WorkerSummary {
  if (!worker) {
    return {
      label: "Checking",
      detail: "Loading the persisted worker control state.",
      tone: "connecting",
    };
  }

  if (!worker.is_enabled) {
    return {
      label: "Stopped",
      detail:
        "Ingestion is disabled. Existing vessel data remains in the database.",
      tone: "idle",
    };
  }

  if (worker.worker_state === "running") {
    if (hasCurrentHeartbeat(worker.last_heartbeat)) {
      return {
        label: "Running",
        detail: "The worker is connected or retrying its AIS subscription.",
        tone: "connected",
      };
    }

    return {
      label: "Unresponsive",
      detail: "The API has not received a recent worker heartbeat.",
      tone: "error",
    };
  }

  return {
    label: "Starting",
    detail: "The worker will start on its next control check.",
    tone: "connecting",
  };
}
