import { createAuthentication } from "../application/authentication.ts";
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
  if (!config.betterAuthSecret) {
    throw new Error("BETTER_AUTH_SECRET is required to start the API");
  }

  const authentication = createAuthentication({
    baseURL: config.betterAuthUrl,
    corsOrigins: config.corsOrigins,
    databaseUrl: config.databaseUrl,
    secret: config.betterAuthSecret,
    tokenTtlSeconds: config.authSessionTtlSeconds,
  });
  const repository = createPostgresAisRepository({
    connectionString: config.databaseUrl,
  });

  try {
    await repository.initialize();
    await authentication.initialize();

    const app = createApiApp({
      authentication,
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
        try {
          await authentication.close();
        } finally {
          await repository.close();
        }
      },
    };
  } catch (error) {
    try {
      await authentication.close();
    } finally {
      await repository.close();
    }
    throw error;
  }
}
