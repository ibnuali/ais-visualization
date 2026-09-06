import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  DEFAULT_TRACK_HOURS,
  MAX_TRACK_HOURS,
} from "../../application/vessel-queries.ts";
import type { VesselQueries } from "../../application/vessel-queries.ts";
import type { WorkerControls } from "../../application/worker-controls.ts";
import {
  toTrackResponse,
  toVesselSnapshotResponses,
  toWorkerControlResponse,
} from "./serializers.ts";

const DEFAULT_CORS_ORIGINS = new Set([
  "http://localhost:5299",
  "http://127.0.0.1:5299",
]);

const unavailableVesselQueries: VesselQueries = {
  getLatestVesselPositions: async () => {
    throw new Error("Vessel queries are not configured");
  },
  getVesselTrack: async () => {
    throw new Error("Vessel queries are not configured");
  },
};

const unavailableWorkerControls: WorkerControls = {
  getStatus: async () => {
    throw new Error("Worker controls are not configured");
  },
  enable: async () => {
    throw new Error("Worker controls are not configured");
  },
  disable: async () => {
    throw new Error("Worker controls are not configured");
  },
};

export interface ApiAppOptions {
  vesselQueries?: VesselQueries;
  workerControls?: WorkerControls;
  workerControlToken?: string;
  corsOrigins?: ReadonlySet<string>;
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

function parseMmsi(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const mmsi = Number(value);
  return Number.isSafeInteger(mmsi) && mmsi >= 1 && mmsi <= 2147483647
    ? mmsi
    : null;
}

function parseTrackHours(value: string | undefined): number | null {
  if (value === undefined) {
    return DEFAULT_TRACK_HOURS;
  }

  const hours = Number(value);
  return Number.isInteger(hours) && hours >= 1 && hours <= MAX_TRACK_HOURS
    ? hours
    : null;
}

export function createApiApp({
  vesselQueries = unavailableVesselQueries,
  workerControls = unavailableWorkerControls,
  workerControlToken,
  corsOrigins = DEFAULT_CORS_ORIGINS,
}: ApiAppOptions = {}): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => (corsOrigins.has(origin) ? origin : null),
      allowHeaders: ["Content-Type", "X-Worker-Control-Token"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/", (context) =>
    context.json({
      name: "AIS anomaly API",
      health: "/health",
      vessels: "/api/vessels",
      worker: "/api/worker",
      tracks: "/api/tracks/:mmsi?hours=24",
    }),
  );

  app.get("/health", (context) => context.json({ status: "ok" }));

  app.get("/api/vessels", async (context) => {
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

  app.get("/api/worker", async (context) => {
    try {
      return context.json({
        ...toWorkerControlResponse(await workerControls.getStatus()),
        control_configured: Boolean(workerControlToken),
      });
    } catch (error) {
      console.error("Worker control query failed:", getErrorMessage(error));
      return context.json(
        { error: "The worker control state could not be loaded" },
        500,
      );
    }
  });

  app.post("/api/worker/:action", async (context) => {
    const action = context.req.param("action");
    const isStartAction = action === "start";
    const isSupportedAction = isStartAction || action === "stop";

    if (!isSupportedAction) {
      return context.json({ error: "Unsupported worker action" }, 404);
    }

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

    try {
      const workerControl = isStartAction
        ? await workerControls.enable()
        : await workerControls.disable();
      return context.json(toWorkerControlResponse(workerControl));
    } catch (error) {
      console.error("Worker control update failed:", getErrorMessage(error));
      return context.json(
        { error: "The worker control state could not be updated" },
        500,
      );
    }
  });

  app.get("/api/tracks/:mmsi", async (context) => {
    const mmsi = parseMmsi(context.req.param("mmsi"));
    if (mmsi === null) {
      return context.json({ error: "mmsi must be a positive integer" }, 400);
    }

    const hours = parseTrackHours(context.req.query("hours"));
    if (hours === null) {
      return context.json(
        { error: `hours must be an integer between 1 and ${MAX_TRACK_HOURS}` },
        400,
      );
    }

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
  });

  return app;
}
