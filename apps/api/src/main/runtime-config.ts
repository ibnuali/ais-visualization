import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CORS_ORIGINS = ["http://localhost:5299", "http://127.0.0.1:5299"];

export interface RuntimeConfig {
  databaseUrl?: string;
  apiKey?: string;
  workerControlToken?: string;
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

  const configuredOrigins = environment.CORS_ORIGINS ?? "";
  const corsOrigins = new Set([
    ...DEFAULT_CORS_ORIGINS,
    ...configuredOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);

  return {
    databaseUrl: environment.DATABASE_URL,
    apiKey: environment.API_KEY,
    workerControlToken: environment.WORKER_CONTROL_TOKEN,
    hostname: environment.HOST || "127.0.0.1",
    port: Number(environment.PORT || 3000),
    corsOrigins,
  };
}
