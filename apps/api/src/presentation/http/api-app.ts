import { timingSafeEqual } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import type { Authentication } from "../../application/authentication.ts";
import {
  DEFAULT_TRACK_HOURS,
  MAX_TRACK_HOURS,
} from "../../application/vessel-queries.ts";
import type { VesselQueries } from "../../application/vessel-queries.ts";
import type { WorkerControls } from "../../application/worker-controls.ts";
import { isWorkerId } from "../../domain/worker-regions.ts";
import {
  toTrackResponse,
  toWorkerAggregateResponse,
  toVesselSnapshotResponses,
  toWorkerControlResponse,
  toWorkerControlResponses,
} from "./serializers.ts";

const DEFAULT_CORS_ORIGINS = new Set([
  "http://localhost:5299",
  "http://127.0.0.1:5299",
]);
const MIN_MMSI = 100_000_000;
const MAX_MMSI = 999_999_999;

type WorkerAction = "start" | "stop";

const unavailableVesselQueries: VesselQueries = {
  getLatestVesselPositions: async () => {
    throw new Error("Vessel queries are not configured");
  },
  getVesselTrack: async () => {
    throw new Error("Vessel queries are not configured");
  },
};

const unavailableWorkerControls: WorkerControls = {
  getStatuses: async () => {
    throw new Error("Worker controls are not configured");
  },
  enable: async () => {
    throw new Error("Worker controls are not configured");
  },
  disable: async () => {
    throw new Error("Worker controls are not configured");
  },
  setAllEnabled: async () => {
    throw new Error("Worker controls are not configured");
  },
};

export interface ApiAppOptions {
  authentication?: Authentication;
  vesselQueries?: VesselQueries;
  workerControls?: WorkerControls;
  workerControlToken?: string;
  corsOrigins?: ReadonlySet<string>;
}

interface ProtectedApiOptions {
  authentication?: Authentication;
  vesselQueries: VesselQueries;
  workerControls: WorkerControls;
  workerControlToken?: string;
}

function hasValidControlToken(
  receivedToken: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!receivedToken || !expectedToken) {
    return false;
  }

  const receivedTokenBytes = Buffer.from(receivedToken);
  const expectedTokenBytes = Buffer.from(expectedToken);

  return (
    receivedTokenBytes.length === expectedTokenBytes.length &&
    timingSafeEqual(receivedTokenBytes, expectedTokenBytes)
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isWorkerAction(value: string | undefined): value is WorkerAction {
  return value === "start" || value === "stop";
}

function parseMmsi(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const mmsi = Number(value);
  return Number.isSafeInteger(mmsi) && mmsi >= MIN_MMSI && mmsi <= MAX_MMSI
    ? mmsi
    : null;
}

function parseTrackHours(value: string | string[] | undefined): number | null {
  if (value === undefined) {
    return DEFAULT_TRACK_HOURS;
  }

  if (Array.isArray(value)) {
    return null;
  }

  const hours = Number(value);
  return Number.isInteger(hours) && hours >= 1 && hours <= MAX_TRACK_HOURS
    ? hours
    : null;
}

function createWorkerControlGuard(
  workerControlToken: string | undefined,
): MiddlewareHandler {
  return async (context, next) => {
    if (!workerControlToken) {
      return context.json(
        { error: "Worker control is not configured on this API" },
        503,
      );
    }

    const receivedToken = context.req.header("X-Worker-Control-Token");
    if (!hasValidControlToken(receivedToken, workerControlToken)) {
      return context.json({ error: "Worker control is unauthorized" }, 401);
    }

    await next();
  };
}

function createProtectedApi({
  authentication,
  vesselQueries,
  workerControls,
  workerControlToken,
}: ProtectedApiOptions): Hono {
  const api = new Hono();
  const requireWorkerControl = createWorkerControlGuard(workerControlToken);

  api.use("*", async (context, next) => {
    if (!authentication) {
      return context.json({ error: "Better Auth is not configured" }, 503);
    }

    try {
      const session = await authentication.getSession(context.req.raw.headers);
      if (!session) {
        return context.json({ error: "Better Auth session is required" }, 401);
      }
    } catch (error) {
      console.error(
        "Better Auth session lookup failed:",
        getErrorMessage(error),
      );
      return context.json({ error: "Authentication service unavailable" }, 503);
    }

    await next();
  });

  api.get("/vessels", async (context) => {
    try {
      return context.json(
        toVesselSnapshotResponses(
          await vesselQueries.getLatestVesselPositions(),
        ),
      );
    } catch (error) {
      console.error("Vessel snapshot query failed:", getErrorMessage(error));
      return context.json(
        { error: "The current vessel snapshot could not be loaded" },
        500,
      );
    }
  });

  api.get("/workers", async (context) => {
    try {
      return context.json({
        workers: toWorkerControlResponses(await workerControls.getStatuses()),
        control_configured: Boolean(workerControlToken),
      });
    } catch (error) {
      console.error("Worker control query failed:", getErrorMessage(error));
      return context.json(
        { error: "The worker control states could not be loaded" },
        500,
      );
    }
  });

  // Keep the original status route as an aggregate endpoint.
  api.get("/worker", async (context) => {
    try {
      return context.json(
        toWorkerAggregateResponse(
          await workerControls.getStatuses(),
          Boolean(workerControlToken),
        ),
      );
    } catch (error) {
      console.error("Worker control query failed:", getErrorMessage(error));
      return context.json(
        { error: "The worker control states could not be loaded" },
        500,
      );
    }
  });

  api.post(
    "/workers/:workerId/:action",
    validator("param", (parameters, context) => {
      const { action, workerId } = parameters;

      if (!isWorkerId(workerId)) {
        return context.json({ error: "Unknown worker region" }, 404);
      }

      if (!isWorkerAction(action)) {
        return context.json({ error: "Unsupported worker action" }, 404);
      }

      return { action, workerId };
    }),
    requireWorkerControl,
    async (context) => {
      const { action, workerId } = context.req.valid("param");

      try {
        const workerControl =
          action === "start"
            ? await workerControls.enable(workerId)
            : await workerControls.disable(workerId);
        return context.json({
          ...toWorkerControlResponse(workerControl),
          control_configured: true,
        });
      } catch (error) {
        console.error("Worker control update failed:", getErrorMessage(error));
        return context.json(
          { error: "The worker control state could not be updated" },
          500,
        );
      }
    },
  );

  // The singular action route remains useful for operators who want to
  // enable or disable all three regional workers at once.
  api.post(
    "/worker/:action",
    validator("param", (parameters, context) => {
      if (!isWorkerAction(parameters.action)) {
        return context.json({ error: "Unsupported worker action" }, 404);
      }

      return { action: parameters.action };
    }),
    requireWorkerControl,
    async (context) => {
      const { action } = context.req.valid("param");

      try {
        await workerControls.setAllEnabled(action === "start");
        return context.json(
          toWorkerAggregateResponse(await workerControls.getStatuses(), true),
        );
      } catch (error) {
        console.error("Worker control update failed:", getErrorMessage(error));
        return context.json(
          { error: "The worker control states could not be updated" },
          500,
        );
      }
    },
  );

  api.get(
    "/tracks/:mmsi",
    validator("param", (parameters, context) => {
      const mmsi = parseMmsi(parameters.mmsi);
      if (mmsi === null) {
        return context.json(
          { error: "mmsi must be a nine-digit integer" },
          400,
        );
      }

      return { mmsi };
    }),
    validator("query", (query, context) => {
      const hours = parseTrackHours(query.hours);
      if (hours === null) {
        return context.json(
          {
            error: `hours must be an integer between 1 and ${MAX_TRACK_HOURS}`,
          },
          400,
        );
      }

      return { hours };
    }),
    async (context) => {
      const { mmsi } = context.req.valid("param");
      const { hours } = context.req.valid("query");

      try {
        return context.json(
          toTrackResponse(await vesselQueries.getVesselTrack(mmsi, hours)),
        );
      } catch (error) {
        console.error("Track query failed:", getErrorMessage(error));
        return context.json(
          { error: "The vessel track could not be loaded" },
          500,
        );
      }
    },
  );

  return api;
}

export function createApiApp({
  authentication,
  vesselQueries = unavailableVesselQueries,
  workerControls = unavailableWorkerControls,
  workerControlToken,
  corsOrigins = DEFAULT_CORS_ORIGINS,
}: ApiAppOptions = {}): Hono {
  const app = new Hono();

  app.onError((error, context) => {
    console.error("Unhandled API error:", getErrorMessage(error));
    return context.json({ error: "Internal server error" }, 500);
  });

  app.notFound((context) => context.json({ error: "Route not found" }, 404));

  app.use(
    "*",
    cors({
      origin: (origin) => (corsOrigins.has(origin) ? origin : null),
      allowHeaders: ["Authorization", "Content-Type", "X-Worker-Control-Token"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      exposeHeaders: ["set-auth-token"],
    }),
  );

  app.all("/api/auth/*", async (context) => {
    if (!authentication) {
      return context.json({ error: "Better Auth is not configured" }, 503);
    }

    return authentication.handler(context.req.raw);
  });

  app.get("/", (context) =>
    context.json({
      name: "AIS anomaly API",
      health: "/health",
      login: "/api/auth/sign-in/username",
      vessels: "/api/vessels",
      workers: "/api/workers",
      worker: "/api/worker",
      tracks: "/api/tracks/:mmsi?hours=24",
    }),
  );

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.route(
    "/api",
    createProtectedApi({
      authentication,
      vesselQueries,
      workerControls,
      workerControlToken,
    }),
  );

  return app;
}
