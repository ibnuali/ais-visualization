import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { requestJson } from "../../../lib/api.ts";
import { getErrorMessage } from "../../../lib/errors.ts";
import type {
  ActivityEvent,
  ActivityType,
  WorkerAction,
  WorkerControl,
  WorkerControlsResponse,
  VesselRecord,
} from "../../../types.ts";
import { WORKER_STATUS_INTERVAL_MS } from "../constants.ts";

const MAX_WORKER_ACTIVITY_EVENTS = 12;
const MAX_RECEIVED_VESSEL_EVENTS = 8;
const WORKER_LATITUDE_RANGE = { maximum: 6, minimum: -11 } as const;
let activitySequence = 0;

function createActivityEvent(
  type: ActivityType,
  title: string,
  detail: string,
): ActivityEvent {
  return {
    id: `worker-activity-${Date.now()}-${activitySequence++}`,
    type,
    title,
    detail,
    timestamp: new Date().toISOString(),
  };
}

function getWorkerStateDetail(worker: WorkerControl): string {
  const requestedState = worker.is_enabled ? "enabled" : "disabled";
  const reportedState =
    worker.worker_state === "running" ? "running" : "stopped";

  return `Requested state: ${requestedState}. Worker reports: ${reportedState}.`;
}

function getWorkerStatusTone(worker: WorkerControl): ActivityType {
  if (!worker.is_enabled) {
    return "warning";
  }

  return worker.worker_state === "running" ? "success" : "info";
}

function isVesselRecord(value: unknown): value is VesselRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { mmsi } = value as { mmsi?: unknown };
  return (
    (typeof mmsi === "string" && mmsi.trim().length > 0) ||
    (typeof mmsi === "number" && Number.isFinite(mmsi))
  );
}

function getWorkerIdForVessel(vessel: VesselRecord): string | null {
  const { latitude, longitude } = vessel;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    latitude < WORKER_LATITUDE_RANGE.minimum ||
    latitude > WORKER_LATITUDE_RANGE.maximum
  ) {
    return null;
  }

  if (longitude >= 95 && longitude <= 110) {
    return "west";
  }

  if (longitude > 110 && longitude <= 126) {
    return "central";
  }

  return longitude > 126 && longitude <= 141 ? "east" : null;
}

function getVesselActivityDetail(vessel: VesselRecord): string {
  const speed =
    typeof vessel.sog === "number" && Number.isFinite(vessel.sog)
      ? ` · ${vessel.sog.toFixed(1)} kn`
      : "";
  const position = `${vessel.latitude?.toFixed(4)}°, ${vessel.longitude?.toFixed(4)}°`;
  const timestamp = new Date(vessel.timestamp ?? "").toLocaleString();

  return `MMSI ${vessel.mmsi} · ${position}${speed} · AIS time ${timestamp}.`;
}

function getVesselActivityTitle(vessel: VesselRecord): string {
  const vesselName = vessel.ship_name?.trim();
  return vesselName
    ? `${vesselName} position received`
    : "Vessel position received";
}

export interface WorkerControlState {
  activityByWorker: Record<string, ActivityEvent[]>;
  controlToken: string;
  error: string;
  isControlConfigured: boolean;
  isSubmitting: boolean;
  sendWorkerAction: (workerId: string, action: WorkerAction) => Promise<void>;
  setControlToken: Dispatch<SetStateAction<string>>;
  workers: WorkerControl[] | null;
}

export function useWorkerControl(): WorkerControlState {
  const [activityByWorker, setActivityByWorker] = useState<
    Record<string, ActivityEvent[]>
  >({});
  const [workers, setWorkers] = useState<WorkerControl[] | null>(null);
  const [isControlConfigured, setIsControlConfigured] = useState(false);
  const [controlToken, setControlToken] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMountedRef = useRef(true);
  const hasReportedVesselActivityFailureRef = useRef(false);
  const vesselActivityRequestRef = useRef<Promise<void> | null>(null);
  const vesselTimestampByWorkerRef = useRef(new Map<string, string>());
  const workersRef = useRef<WorkerControl[] | null>(null);

  const addWorkerActivity = useCallback(
    (
      workerId: string,
      type: ActivityType,
      title: string,
      detail: string,
    ): void => {
      setActivityByWorker((currentActivityByWorker) => ({
        ...currentActivityByWorker,
        [workerId]: [
          createActivityEvent(type, title, detail),
          ...(currentActivityByWorker[workerId] ?? []),
        ].slice(0, MAX_WORKER_ACTIVITY_EVENTS),
      }));
    },
    [],
  );

  const recordWorkerActivity = useCallback(
    (nextWorkers: WorkerControl[]): void => {
      const previousWorkers = new Map(
        workersRef.current?.map((worker) => [worker.worker_id, worker]),
      );

      nextWorkers.forEach((worker) => {
        const previousWorker = previousWorkers.get(worker.worker_id);

        if (!previousWorker) {
          addWorkerActivity(
            worker.worker_id,
            getWorkerStatusTone(worker),
            "Worker status received",
            getWorkerStateDetail(worker),
          );
          return;
        }

        if (previousWorker.is_enabled !== worker.is_enabled) {
          addWorkerActivity(
            worker.worker_id,
            worker.is_enabled ? "success" : "warning",
            worker.is_enabled ? "Ingestion enabled" : "Ingestion disabled",
            getWorkerStateDetail(worker),
          );
          return;
        }

        if (previousWorker.worker_state !== worker.worker_state) {
          addWorkerActivity(
            worker.worker_id,
            worker.worker_state === "running" ? "success" : "warning",
            worker.worker_state === "running"
              ? "Worker running"
              : "Worker stopped",
            getWorkerStateDetail(worker),
          );
          return;
        }

        if (
          worker.last_heartbeat &&
          previousWorker.last_heartbeat !== worker.last_heartbeat
        ) {
          addWorkerActivity(
            worker.worker_id,
            "result",
            "Heartbeat received",
            `Latest heartbeat: ${worker.last_heartbeat}.`,
          );
        }
      });

      workersRef.current = nextWorkers;
    },
    [addWorkerActivity],
  );

  const loadVesselActivity = useCallback(async (): Promise<void> => {
    if (vesselActivityRequestRef.current) {
      return vesselActivityRequestRef.current;
    }

    const request = (async (): Promise<void> => {
      try {
        const payload = await requestJson<unknown>("/api/vessels");
        if (!Array.isArray(payload)) {
          throw new Error("The API returned an invalid vessel snapshot.");
        }

        if (!isMountedRef.current) {
          return;
        }

        const receivedVesselsByWorker = new Map<string, VesselRecord[]>();
        payload.filter(isVesselRecord).forEach((vessel) => {
          const workerId = getWorkerIdForVessel(vessel);
          const timestamp = vessel.timestamp;
          if (!workerId || typeof timestamp !== "string") {
            return;
          }

          const vesselKey = `${workerId}:${vessel.mmsi}`;
          if (vesselTimestampByWorkerRef.current.get(vesselKey) === timestamp) {
            return;
          }

          vesselTimestampByWorkerRef.current.set(vesselKey, timestamp);
          const receivedVessels = receivedVesselsByWorker.get(workerId) ?? [];
          receivedVessels.push(vessel);
          receivedVesselsByWorker.set(workerId, receivedVessels);
        });

        receivedVesselsByWorker.forEach((receivedVessels, workerId) => {
          receivedVessels
            .sort(
              (left, right) =>
                Date.parse(left.timestamp ?? "") -
                Date.parse(right.timestamp ?? ""),
            )
            .slice(-MAX_RECEIVED_VESSEL_EVENTS)
            .forEach((vessel) => {
              addWorkerActivity(
                workerId,
                "result",
                getVesselActivityTitle(vessel),
                getVesselActivityDetail(vessel),
              );
            });
        });

        hasReportedVesselActivityFailureRef.current = false;
      } catch (requestError) {
        if (
          !isMountedRef.current ||
          hasReportedVesselActivityFailureRef.current
        ) {
          return;
        }

        hasReportedVesselActivityFailureRef.current = true;
        const detail = getErrorMessage(
          requestError,
          "The newest vessel reports could not be loaded.",
        );
        workersRef.current?.forEach((worker) => {
          addWorkerActivity(
            worker.worker_id,
            "warning",
            "Vessel activity unavailable",
            detail,
          );
        });
      } finally {
        vesselActivityRequestRef.current = null;
      }
    })();

    vesselActivityRequestRef.current = request;
    return request;
  }, [addWorkerActivity]);

  const loadWorkers = useCallback(async (): Promise<void> => {
    try {
      const payload = await requestJson<WorkerControlsResponse>("/api/workers");

      if (!isMountedRef.current) {
        return;
      }

      recordWorkerActivity(payload.workers);
      setWorkers(payload.workers);
      void loadVesselActivity();
      setIsControlConfigured(payload.control_configured);
      setError("");
    } catch (requestError) {
      if (!isMountedRef.current) {
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          "The worker control states could not be loaded.",
        ),
      );
    }
  }, [loadVesselActivity, recordWorkerActivity]);

  const sendWorkerAction = useCallback(
    async (workerId: string, action: WorkerAction): Promise<void> => {
      const actionLabel = action === "start" ? "Start" : "Stop";

      if (!controlToken) {
        const message =
          "Enter the worker control token to change the ingestion state.";
        setError(message);
        addWorkerActivity(
          workerId,
          "warning",
          `${actionLabel} blocked`,
          message,
        );
        return;
      }

      addWorkerActivity(
        workerId,
        "info",
        `${actionLabel} requested`,
        `Sending a request to ${action} ingestion for this region.`,
      );
      setIsSubmitting(true);
      try {
        await requestJson<WorkerControl>(
          `/api/workers/${encodeURIComponent(workerId)}/${action}`,
          {
            method: "POST",
            headers: {
              "X-Worker-Control-Token": controlToken,
            },
          },
        );

        addWorkerActivity(
          workerId,
          "success",
          `${actionLabel} accepted`,
          `The API accepted the ${action} request. Waiting for the next worker status update.`,
        );
        await loadWorkers();
      } catch (requestError) {
        if (isMountedRef.current) {
          const message = getErrorMessage(
            requestError,
            "The worker control state could not be updated.",
          );
          setError(message);
          addWorkerActivity(
            workerId,
            "error",
            `${actionLabel} failed`,
            message,
          );
        }
      } finally {
        if (isMountedRef.current) {
          setControlToken("");
          setIsSubmitting(false);
        }
      }
    },
    [addWorkerActivity, controlToken, loadWorkers],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadWorkers();
    const statusTimer = window.setInterval(() => {
      void loadWorkers();
    }, WORKER_STATUS_INTERVAL_MS);

    return () => window.clearInterval(statusTimer);
  }, [loadWorkers]);

  return {
    activityByWorker,
    controlToken,
    error,
    isControlConfigured,
    isSubmitting,
    sendWorkerAction,
    setControlToken,
    workers,
  };
}
