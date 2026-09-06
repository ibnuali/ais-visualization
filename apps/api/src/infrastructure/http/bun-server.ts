import type { Hono } from "hono";

const DEFAULT_PORT = 3000;

export interface BunServerOptions {
  hostname?: string;
  port?: number;
}

export interface RunningBunServer {
  port: number;
  stop(): Promise<void>;
}

export function startBunServer(
  app: Hono,
  { hostname = "127.0.0.1", port = DEFAULT_PORT }: BunServerOptions = {},
): RunningBunServer {
  if (!hostname || typeof hostname !== "string") {
    throw new Error("HOST must be a non-empty hostname");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  if (typeof Bun === "undefined") {
    throw new Error("The API server must be started with Bun");
  }

  const server = Bun.serve({
    hostname,
    port,
    fetch: app.fetch,
  });

  const boundPort = server.port ?? port;
  process.stdout.write(
    `AIS API listening on http://${hostname}:${boundPort}\n`,
  );

  return {
    port: boundPort,
    stop: () => server.stop(),
  };
}
