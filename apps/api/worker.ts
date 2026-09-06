import { loadRuntimeConfig } from "./src/main/runtime-config.ts";
import { startWorkerRuntime } from "./src/main/start-worker-runtime.ts";

const workerRuntime = await startWorkerRuntime(loadRuntimeConfig());

let isShuttingDown = false;
const shutdown = async (signal: "SIGINT" | "SIGTERM"): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  process.stdout.write(`Received ${signal}; stopping AIS ingestion worker\n`);
  await workerRuntime.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
