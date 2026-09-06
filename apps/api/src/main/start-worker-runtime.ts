import { createIngestionWorker } from "../application/worker-controller.ts";
import { createAisIngestion } from "../infrastructure/ais/ais-ingestion.ts";
import { createPostgresAisRepository } from "../infrastructure/postgres/ais-repository.ts";
import type { RuntimeConfig } from "./runtime-config.ts";

export interface WorkerRuntime {
  stop(): Promise<void>;
}

export async function startWorkerRuntime(
  config: RuntimeConfig,
): Promise<WorkerRuntime> {
  if (!config.apiKey) {
    throw new Error("API_KEY is required to start the AIS ingestion worker");
  }

  const repository = createPostgresAisRepository({
    connectionString: config.databaseUrl,
  });

  await repository.initialize();
  try {
    const worker = createIngestionWorker({
      apiKey: config.apiKey,
      createIngestion: createAisIngestion,
      workerControlStore: repository,
      vesselDataWriter: repository,
    });

    await worker.start();
    process.stdout.write(
      "AIS ingestion worker is ready for start and stop commands\n",
    );

    return {
      stop: async (): Promise<void> => {
        try {
          await worker.stop();
        } finally {
          await repository.close();
        }
      },
    };
  } catch (error) {
    await repository.close();
    throw error;
  }
}
