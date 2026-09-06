import { createVesselQueries } from "../application/vessel-queries.ts";
import { createWorkerControls } from "../application/worker-controls.ts";
import { startBunServer } from "../infrastructure/http/bun-server.ts";
import { createPostgresAisRepository } from "../infrastructure/postgres/ais-repository.ts";
import { createApiApp } from "../presentation/http/api-app.ts";
import type { RuntimeConfig } from "./runtime-config.ts";

export interface ApiRuntime {
  stop(): Promise<void>;
}

export async function startApiRuntime(
  config: RuntimeConfig,
): Promise<ApiRuntime> {
  const repository = createPostgresAisRepository({
    connectionString: config.databaseUrl,
  });

  await repository.initialize();
  try {
    const app = createApiApp({
      vesselQueries: createVesselQueries(repository),
      workerControls: createWorkerControls(repository),
      workerControlToken: config.workerControlToken,
      corsOrigins: config.corsOrigins,
    });
    const server = startBunServer(app, {
      hostname: config.hostname,
      port: config.port,
    });

    return {
      stop: async (): Promise<void> => {
        await server.stop();
        await repository.close();
      },
    };
  } catch (error) {
    await repository.close();
    throw error;
  }
}
