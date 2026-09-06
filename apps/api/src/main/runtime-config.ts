import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_WORKER_ID,
  isWorkerId,
  WORKER_IDS,
} from "../domain/worker-regions.ts";
import type { WorkerId } from "../domain/models.ts";

export interface RuntimeConfig {
  betterAuthSecret?: string;
  betterAuthUrl: string;
  databaseUrl: string;
  apiKey?: string;
  authSessionTtlSeconds: number;
  workerControlToken?: string;
  workerId: WorkerId;
  hostname: string;
  port: number;
  corsOrigins: ReadonlySet<string>;
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const apiDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  const workspaceRoot = resolve(apiDirectory, "../..");

  // Prefer API-local configuration while preserving the workspace-root fallback.
  dotenv.config({ path: resolve(apiDirectory, ".env") });
  dotenv.config({ path: resolve(workspaceRoot, ".env") });

  const configuredWorkerId = environment.WORKER_ID?.trim() || DEFAULT_WORKER_ID;
  if (!isWorkerId(configuredWorkerId)) {
    throw new Error(`WORKER_ID must be one of: ${WORKER_IDS.join(", ")}`);
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const configuredPort = Number(environment.PORT || 3000);
  const betterAuthUrl =
    environment.BETTER_AUTH_URL?.trim() || `http://localhost:${configuredPort}`;
  const configuredOrigins = environment.CORS_ORIGINS ?? "";
  const corsOrigins = new Set(
    configuredOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  return {
    betterAuthSecret: environment.BETTER_AUTH_SECRET?.trim(),
    betterAuthUrl,
    databaseUrl,
    apiKey: environment.API_KEY,
    authSessionTtlSeconds: Number(
      environment.AUTH_SESSION_TTL_SECONDS || 28_800,
    ),
    workerControlToken: environment.WORKER_CONTROL_TOKEN,
    workerId: configuredWorkerId,
    hostname: environment.HOST || "127.0.0.1",
    port: configuredPort,
    corsOrigins,
  };
}
