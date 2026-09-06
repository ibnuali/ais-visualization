import { startApiRuntime } from "./src/main/start-api-runtime.ts";
import { loadRuntimeConfig } from "./src/main/runtime-config.ts";

const apiRuntime = await startApiRuntime(loadRuntimeConfig());

let isShuttingDown = false;
const shutdown = async (signal: "SIGINT" | "SIGTERM"): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  process.stdout.write(`Received ${signal}; shutting down AIS API\n`);
  await apiRuntime.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
