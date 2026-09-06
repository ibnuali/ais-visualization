import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "../../../lib/errors.ts";
import { requestJson } from "../../../lib/api.ts";
import type {
  ActivityType,
  DataState,
  VesselRecord,
  VesselRecordMap,
} from "../../../types.ts";
import { MAP_REFRESH_INTERVAL_MS } from "../constants.ts";
import { recordsFromSnapshot, sortVessels } from "../utils.ts";

interface WorkerStatusResponse {
  is_enabled: boolean;
}

interface UseVesselSnapshotOptions {
  addActivity: (type: ActivityType, title: string, detail: string) => void;
}

export interface VesselSnapshotState {
  dataState: DataState;
  lastUpdateAt: string | null;
  refreshSnapshot: (options?: { isManual?: boolean }) => Promise<void>;
  snapshotCount: number;
  vessels: VesselRecord[];
}

export function useVesselSnapshot({
  addActivity,
}: UseVesselSnapshotOptions): VesselSnapshotState {
  const [dataState, setDataState] = useState<DataState>("connecting");
  const [vesselRecords, setVesselRecords] = useState<VesselRecordMap>({});
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);

  const snapshotRequestRef = useRef<Promise<void> | null>(null);
  const workerEnabledRef = useRef<boolean | null>(null);
  const hasLoadedSnapshotRef = useRef(false);
  const hasReportedSnapshotFailureRef = useRef(false);
  const isMountedRef = useRef(true);

  const replaceVesselRecords = useCallback((records: unknown[]) => {
    setVesselRecords(recordsFromSnapshot(records));
  }, []);

  const refreshSnapshot = useCallback(
    async ({
      isManual = false,
    }: {
      isManual?: boolean;
    } = {}): Promise<void> => {
      if (snapshotRequestRef.current) {
        return snapshotRequestRef.current;
      }

      const request: Promise<void> = (async () => {
        try {
          const worker = await requestJson<WorkerStatusResponse>(
            "/api/worker",
            {
              errorPrefix: "The worker API returned",
            },
          );

          if (typeof worker?.is_enabled !== "boolean") {
            throw new Error("The worker API returned an invalid state.");
          }

          const previousWorkerEnabled = workerEnabledRef.current;
          const workerIsEnabled = worker.is_enabled;
          workerEnabledRef.current = workerIsEnabled;
          const shouldFetchSnapshot =
            isManual || workerIsEnabled || previousWorkerEnabled !== false;

          if (!workerIsEnabled) {
            if (isMountedRef.current) {
              setDataState("stopped");
            }
            if (!shouldFetchSnapshot) {
              return;
            }
          } else if (isMountedRef.current) {
            setDataState("connecting");
          }

          const vessels = await requestJson<unknown>("/api/vessels");
          if (!Array.isArray(vessels)) {
            throw new Error("The API returned an invalid vessel snapshot.");
          }

          if (!isMountedRef.current) {
            return;
          }

          replaceVesselRecords(vessels);
          setDataState(workerIsEnabled ? "connected" : "stopped");
          setSnapshotCount((count) => count + 1);
          setLastUpdateAt(new Date().toISOString());
          hasReportedSnapshotFailureRef.current = false;

          if (!hasLoadedSnapshotRef.current || isManual) {
            addActivity(
              "success",
              hasLoadedSnapshotRef.current
                ? "Snapshot refreshed"
                : "Snapshot loaded",
              `${vessels.length.toLocaleString()} vessels are available from the database.`,
            );
          }
          hasLoadedSnapshotRef.current = true;
        } catch (error) {
          if (!isMountedRef.current) {
            return;
          }

          setDataState("error");
          if (!hasReportedSnapshotFailureRef.current || isManual) {
            addActivity(
              "error",
              "Snapshot unavailable",
              getErrorMessage(
                error,
                "The latest vessel positions could not be loaded.",
              ),
            );
          }
          hasReportedSnapshotFailureRef.current = true;
        } finally {
          snapshotRequestRef.current = null;
        }
      })();

      snapshotRequestRef.current = request;
      return request;
    },
    [addActivity, replaceVesselRecords],
  );

  const vessels = useMemo(() => sortVessels(vesselRecords), [vesselRecords]);

  useEffect(() => {
    void refreshSnapshot();
    const refreshTimer = window.setInterval(() => {
      void refreshSnapshot();
    }, MAP_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, [refreshSnapshot]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    dataState,
    lastUpdateAt,
    refreshSnapshot,
    snapshotCount,
    vessels,
  };
}
