import type {
  CreateIngestion,
  Logger,
  VesselDataWriter,
  WorkerControlStore,
} from "./ports.ts";

export interface IngestionWorkerOptions {
  apiKey?: string;
  createIngestion?: CreateIngestion;
  workerControlStore?: WorkerControlStore;
  vesselDataWriter?: VesselDataWriter;
  logger?: Pick<Logger, "error" | "info">;
  pollIntervalMs?: number;
}

export interface IngestionWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  reconcile(): Promise<void>;
  isRunning(): boolean;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createIngestionWorker({
  apiKey,
  createIngestion,
  workerControlStore,
  vesselDataWriter,
  logger = console,
  pollIntervalMs = 2000,
}: IngestionWorkerOptions = {}): IngestionWorker {
  if (!apiKey) {
    throw new Error("AIS worker controller requires an API key");
  }

  if (typeof createIngestion !== "function") {
    throw new Error("AIS worker controller requires an ingestion factory");
  }

  if (!workerControlStore || !vesselDataWriter) {
    throw new Error("AIS worker controller requires persistence adapters");
  }

  let ingestion: ReturnType<CreateIngestion> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let isStopped = false;
  let isReconciling = false;

  const reconcile = async (): Promise<void> => {
    if (isStopped || isReconciling) {
      return;
    }

    isReconciling = true;
    try {
      const control = await workerControlStore.getWorkerControl();
      const shouldRun = control.isEnabled;

      if (shouldRun && !ingestion) {
        ingestion = createIngestion({
          apiKey,
          onPosition: (position) => vesselDataWriter.storePosition(position),
          onMetadata: (metadata) =>
            vesselDataWriter.storeShipStaticData(metadata),
        });
        logger.info("AIS ingestion enabled");
      } else if (!shouldRun && ingestion) {
        ingestion.stop();
        ingestion = null;
        logger.info("AIS ingestion stopped");
      }

      await workerControlStore.setWorkerState(
        ingestion ? "running" : "stopped",
      );
    } finally {
      isReconciling = false;
    }
  };

  const start = async (): Promise<void> => {
    if (isStopped) {
      throw new Error("AIS worker controller cannot restart after shutdown");
    }

    await reconcile();
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        void reconcile().catch((error: unknown) => {
          logger.error(
            "AIS worker control sync failed:",
            getErrorMessage(error),
          );
        });
      }, pollIntervalMs);
    }
  };

  const stop = async (): Promise<void> => {
    isStopped = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (ingestion) {
      ingestion.stop();
      ingestion = null;
    }

    await workerControlStore.setWorkerState("stopped");
  };

  return {
    start,
    stop,
    reconcile,
    isRunning: () => Boolean(ingestion),
  };
}
