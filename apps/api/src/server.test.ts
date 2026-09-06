import { describe, expect, test } from "bun:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { RawData } from "ws";
import {
  createAuthentication,
  createBetterAuth,
} from "./application/authentication.ts";
import { createIngestionWorker } from "./application/worker-controller.ts";
import type { VesselQueries } from "./application/vessel-queries.ts";
import type { WorkerControls } from "./application/worker-controls.ts";
import type {
  PositionReport,
  ShipStaticData,
  TrackFeature,
  VesselSnapshot,
  WorkerControl,
  WorkerState,
} from "./domain/models.ts";
import {
  createAisIngestion,
  type AisLogger,
  type AisSocket,
} from "./infrastructure/ais/ais-ingestion.ts";
import { loadRuntimeConfig } from "./main/runtime-config.ts";
import { createApiApp } from "./presentation/http/api-app.ts";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type TestSocketHandlers = {
  open: () => void;
  close: () => void;
  message: (data: RawData | string) => void;
  error: (error: Error) => void;
};

class TestSocket implements AisSocket {
  constructor(private readonly handlers: TestSocketHandlers) {}

  on(event: "open" | "close", listener: () => void): AisSocket;
  on(event: "message", listener: (data: RawData | string) => void): AisSocket;
  on(event: "error", listener: (error: Error) => void): AisSocket;
  on(
    event: "open" | "close" | "message" | "error",
    listener:
      | (() => void)
      | ((data: RawData | string) => void)
      | ((error: Error) => void),
  ): AisSocket {
    if (event === "open" || event === "close") {
      this.handlers[event] = listener as () => void;
    } else if (event === "message") {
      this.handlers.message = listener as (data: RawData | string) => void;
    } else {
      this.handlers.error = listener as (error: Error) => void;
    }
    return this;
  }

  send(payload: string): void {
    this.sentMessages.push(JSON.parse(payload));
  }

  close(): void {}

  readonly sentMessages: unknown[] = [];
}

const testWorkerControl: WorkerControl = {
  workerId: "west",
  isEnabled: false,
  workerState: "stopped",
  updatedAt: "2026-09-03T00:00:00.000Z",
  lastHeartbeat: "2026-09-03T00:00:00.000Z",
};

const emptyVesselQueries: VesselQueries = {
  getLatestVesselPositions: async () => [],
  getVesselTrack: async () => ({
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: {
      timestamps: [],
      headings: [],
      sogs: [],
      cogs: [],
      nav_statuses: [],
    },
  }),
};

const emptyWorkerControls: WorkerControls = {
  getStatuses: async () => [testWorkerControl],
  enable: async (workerId) => ({
    ...testWorkerControl,
    workerId,
    isEnabled: true,
  }),
  disable: async (workerId) => ({ ...testWorkerControl, workerId }),
  setAllEnabled: async () => undefined,
};

const testDatabase = memoryAdapter({
  account: [],
  session: [],
  user: [],
  verification: [],
});
const testProvisioningAuth = createBetterAuth({
  baseURL: "http://localhost:3000",
  corsOrigins: new Set(["http://localhost:5299"]),
  database: testDatabase,
  disableSignUp: false,
  secret: "test-better-auth-secret-that-is-long-enough",
  tokenTtlSeconds: 60,
});
await testProvisioningAuth.$context;
await testProvisioningAuth.api.signUpEmail({
  body: {
    email: "operator@ais-anomaly.test",
    name: "operator",
    password: "test-password",
    username: "operator",
  },
});

const testAuthentication = createAuthentication({
  baseURL: "http://localhost:3000",
  corsOrigins: new Set(["http://localhost:5299"]),
  database: testDatabase,
  secret: "test-better-auth-secret-that-is-long-enough",
  tokenTtlSeconds: 60,
});
await testAuthentication.initialize();

async function createAuthorizationHeaders(): Promise<Record<string, string>> {
  const response = await testAuthentication.handler(
    new Request("http://localhost:3000/api/auth/sign-in/username", {
      body: JSON.stringify({ password: "test-password", username: "operator" }),
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5299",
      },
      method: "POST",
    }),
  );
  const authToken = response.headers.get("set-auth-token");
  if (!response.ok || !authToken) {
    throw new Error("Test Better Auth credentials must be valid");
  }

  return { Authorization: `Bearer ${authToken}` };
}

const testAuthorizationHeaders = await createAuthorizationHeaders();

function authorizationHeaders(): Record<string, string> {
  return testAuthorizationHeaders;
}

describe("Better Auth authentication", () => {
  test("authenticates a separately provisioned operator", async () => {
    const response = await testAuthentication.handler(
      new Request("http://localhost:3000/api/auth/sign-in/username", {
        body: JSON.stringify({
          password: "test-password",
          username: "operator",
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5299",
        },
        method: "POST",
      }),
    );
    const authToken = response.headers.get("set-auth-token");

    expect(response.status).toBe(200);
    expect(authToken).toBeTruthy();
    expect(
      await testAuthentication.getSession(
        new Headers({ Authorization: `Bearer ${authToken}` }),
      ),
    ).not.toBeNull();
  });
});

describe("AIS ingestion adapter", () => {
  test("translates upstream messages without exposing them to the API", async () => {
    const handlers: TestSocketHandlers = {
      open: () => {},
      close: () => {},
      message: () => {},
      error: () => {},
    };
    const socket = new TestSocket(handlers);
    const positions: PositionReport[] = [];
    const metadata: ShipStaticData[] = [];
    const logger: AisLogger = { error() {}, info() {}, warn() {} };
    const ingestion = createAisIngestion({
      apiKey: "test-key",
      logger,
      onMetadata: async (value) => {
        metadata.push(value);
      },
      onPosition: async (value) => {
        positions.push(value);
      },
      socketFactory: () => socket,
    });

    handlers.open();
    handlers.message(
      JSON.stringify({
        MessageType: "PositionReport",
        MetaData: {
          MMSI: 525000000,
          ShipName: " MV Position Name ",
        },
        Message: {
          PositionReport: {
            UserID: 525000000,
            Latitude: -5,
            Longitude: 111,
            Sog: 10,
            Cog: 90,
            TrueHeading: 88,
            NavigationStatus: 0,
          },
        },
      }),
    );
    handlers.message(
      JSON.stringify({
        MessageType: "ShipStaticData",
        Message: {
          ShipStaticData: {
            UserID: 525000000,
            Name: " MV Test ",
            Type: 70,
            ImoNumber: 9876543,
            CallSign: "TEST",
            Destination: " Port ",
            Dimension: { A: 10, B: 20, C: 3, D: 4 },
          },
        },
      }),
    );
    await wait(5);
    ingestion.stop();

    expect(socket.sentMessages[0]).toEqual({
      APIkey: "test-key",
      BoundingBoxes: [
        [
          [-11, 95],
          [6, 141],
        ],
      ],
    });
    expect(positions[0]).toMatchObject({
      mmsi: 525000000,
      latitude: -5,
      longitude: 111,
      navStatus: "Under way using engine",
      vesselClass: "A",
    });
    expect(metadata).toContainEqual(
      expect.objectContaining({
        mmsi: 525000000,
        shipName: "MV Position Name",
      }),
    );
    expect(metadata).toContainEqual(
      expect.objectContaining({
        mmsi: 525000000,
        shipName: "MV Test",
        shipType: 70,
        imo: 9876543,
        callSign: "TEST",
        destination: "Port",
        dimBow: 10,
        dimStern: 20,
        dimPort: 3,
        dimStarboard: 4,
      }),
    );
  });
});

describe("ingestion worker use case", () => {
  test("starts and stops ingestion when the persisted control state changes", async () => {
    let control: WorkerControl = { ...testWorkerControl, isEnabled: true };
    const workerStates: WorkerState[] = [];
    const ingestions: Array<{ stop(): void; stopped?: boolean }> = [];
    const controller = createIngestionWorker({
      apiKey: "test-key",
      createIngestion: () => {
        const ingestion: { stop(): void; stopped?: boolean } = {
          stop: (): void => {
            ingestion.stopped = true;
          },
        };
        ingestions.push(ingestion);
        return ingestion;
      },
      workerControlStore: {
        getWorkerControls: async () => [control],
        getWorkerControl: async () => control,
        setWorkerEnabled: async (_workerId, isEnabled) => ({
          ...control,
          isEnabled,
        }),
        setAllWorkerEnabled: async () => undefined,
        setWorkerState: async (_workerId, workerState) => {
          workerStates.push(workerState);
          control = { ...control, workerState };
          return control;
        },
      },
      vesselDataWriter: {
        storePosition: async () => undefined,
        storeShipStaticData: async () => undefined,
      },
      pollIntervalMs: 60_000,
      logger: { error() {}, info() {} },
    });

    await controller.start();
    expect(controller.isRunning()).toBe(true);
    expect(ingestions).toHaveLength(1);
    expect(workerStates).toEqual(["running"]);

    control = { ...control, isEnabled: false };
    await controller.reconcile();

    expect(controller.isRunning()).toBe(false);
    expect(ingestions[0].stopped).toBe(true);
    expect(workerStates).toEqual(["running", "stopped"]);
    await controller.stop();
  });
});

describe("runtime configuration", () => {
  test("requires a database URL", () => {
    expect(() => loadRuntimeConfig({ DATABASE_URL: " " })).toThrow(
      "DATABASE_URL is required",
    );
  });
});

describe("HTTP API adapter", () => {
  test("keeps health public and returns JSON errors for unavailable routes", async () => {
    const app = createApiApp();
    const healthResponse = await app.request("http://localhost/health");
    const unconfiguredApiResponse = await app.request(
      "http://localhost/api/vessels",
    );
    const missingResponse = await app.request("http://localhost/missing");

    expect(healthResponse.status).toBe(200);
    expect(await healthResponse.json()).toEqual({ status: "ok" });
    expect(unconfiguredApiResponse.status).toBe(503);
    expect(await unconfiguredApiResponse.json()).toEqual({
      error: "Better Auth is not configured",
    });
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({ error: "Route not found" });
  });

  test("delegates Better Auth sign-in and protects API routes", async () => {
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: emptyVesselQueries,
      workerControls: emptyWorkerControls,
      corsOrigins: new Set(["http://localhost:5299"]),
    });

    const preflightResponse = await app.request(
      "http://localhost/api/vessels",
      {
        headers: {
          "Access-Control-Request-Headers": "Authorization",
          "Access-Control-Request-Method": "GET",
          Origin: "http://localhost:5299",
        },
        method: "OPTIONS",
      },
    );
    const anonymousResponse = await app.request("http://localhost/api/vessels");
    const rejectedLoginResponse = await app.request(
      "http://localhost/api/auth/sign-in/username",
      {
        body: JSON.stringify({ password: "wrong", username: "operator" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const signInResponse = await app.request(
      "http://localhost/api/auth/sign-in/username",
      {
        body: JSON.stringify({
          password: "test-password",
          username: "operator",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    const signInPayload = (await signInResponse.json()) as {
      token: string;
    };
    const authToken = signInResponse.headers.get("set-auth-token");
    const sessionCookie = signInResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    const authorizedResponse = await app.request(
      "http://localhost/api/vessels",
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const cookieAuthorizedResponse = await app.request(
      "http://localhost/api/vessels",
      { headers: sessionCookie ? { Cookie: sessionCookie } : {} },
    );
    const signUpResponse = await app.request(
      "http://localhost/api/auth/sign-up/email",
      {
        body: JSON.stringify({
          email: "another@ais-anomaly.test",
          name: "Another operator",
          password: "another-password",
          username: "another",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5299",
    );
    expect(anonymousResponse.status).toBe(401);
    expect(rejectedLoginResponse.status).toBe(401);
    expect(signInResponse.status).toBe(200);
    expect(signInPayload.token).toBeTruthy();
    expect(authToken).toBeTruthy();
    expect(authorizedResponse.status).toBe(200);
    expect(cookieAuthorizedResponse.status).toBe(200);
    expect(signUpResponse.status).toBe(404);
  });

  test("serializes the latest vessel snapshot without exposing persistence names", async () => {
    const vessels: VesselSnapshot[] = [
      {
        mmsi: 525000000,
        timestamp: "now",
        latitude: -5,
        longitude: 111,
        sog: 10,
        cog: 90,
        heading: 88,
        rot: null,
        navigationStatus: "Under way using engine",
        vesselClass: "A",
        shipName: "MV Test",
        shipType: 70,
        callSign: "TEST",
        imo: "9876543",
        destination: "Port",
      },
    ];
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: {
        ...emptyVesselQueries,
        getLatestVesselPositions: async () => vessels,
      },
      workerControls: emptyWorkerControls,
    });

    const response = await app.request("http://localhost/api/vessels", {
      headers: authorizationHeaders(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        mmsi: 525000000,
        timestamp: "now",
        latitude: -5,
        longitude: 111,
        sog: 10,
        cog: 90,
        heading: 88,
        rot: null,
        nav_status: "Under way using engine",
        vessel_class: "A",
        ship_name: "MV Test",
        ship_type: 70,
        call_sign: "TEST",
        imo: "9876543",
        destination: "Port",
      },
    ]);
  });

  test("reports all regional workers and applies aggregate updates through one operation", async () => {
    const requestedStates: Array<{ workerId: string; enabled: boolean }> = [];
    const aggregateStates: boolean[] = [];
    let workerControl = { ...testWorkerControl };
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: emptyVesselQueries,
      workerControls: {
        getStatuses: async () => [workerControl],
        enable: async (workerId) => {
          requestedStates.push({ workerId, enabled: true });
          workerControl = { ...workerControl, workerId, isEnabled: true };
          return workerControl;
        },
        disable: async (workerId) => {
          requestedStates.push({ workerId, enabled: false });
          workerControl = { ...workerControl, workerId, isEnabled: false };
          return workerControl;
        },
        setAllEnabled: async (isEnabled) => {
          aggregateStates.push(isEnabled);
          workerControl = { ...workerControl, isEnabled };
        },
      },
      workerControlToken: "test-control-token",
    });

    const statusResponse = await app.request("http://localhost/api/workers", {
      headers: authorizationHeaders(),
    });
    const legacyStatusResponse = await app.request(
      "http://localhost/api/worker",
      { headers: authorizationHeaders() },
    );
    const unauthorizedResponse = await app.request(
      "http://localhost/api/workers/west/start",
      { method: "POST" },
    );
    const unknownRegionResponse = await app.request(
      "http://localhost/api/workers/unknown/start",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "test-control-token",
        },
      },
    );
    const unsupportedActionResponse = await app.request(
      "http://localhost/api/workers/west/restart",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "test-control-token",
        },
      },
    );
    const startResponse = await app.request(
      "http://localhost/api/workers/west/start",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "test-control-token",
        },
      },
    );
    const stopResponse = await app.request(
      "http://localhost/api/workers/west/stop",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "test-control-token",
        },
      },
    );

    const aggregateStartResponse = await app.request(
      "http://localhost/api/worker/start",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "test-control-token",
        },
      },
    );

    const expectedWorkerResponse = {
      worker_id: "west",
      region: "Indonesia West",
      region_description: "Indian Ocean to western Java",
      is_enabled: false,
      worker_state: "stopped",
      updated_at: "2026-09-03T00:00:00.000Z",
      last_heartbeat: "2026-09-03T00:00:00.000Z",
    };
    expect(await statusResponse.json()).toEqual({
      workers: [expectedWorkerResponse],
      control_configured: true,
    });
    expect(await legacyStatusResponse.json()).toEqual({
      is_enabled: false,
      worker_state: "stopped",
      updated_at: "2026-09-03T00:00:00.000Z",
      last_heartbeat: "2026-09-03T00:00:00.000Z",
      control_configured: true,
      workers: [expectedWorkerResponse],
    });
    expect(unauthorizedResponse.status).toBe(401);
    expect(unknownRegionResponse.status).toBe(404);
    expect(unsupportedActionResponse.status).toBe(404);
    expect(startResponse.status).toBe(200);
    expect(stopResponse.status).toBe(200);
    expect(aggregateStartResponse.status).toBe(200);
    expect(requestedStates).toEqual([
      { workerId: "west", enabled: true },
      { workerId: "west", enabled: false },
    ]);
    expect(aggregateStates).toEqual([true]);
  });

  test("rejects worker updates without a configured control token", async () => {
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: emptyVesselQueries,
      workerControls: emptyWorkerControls,
    });

    const response = await app.request(
      "http://localhost/api/workers/west/start",
      {
        method: "POST",
        headers: {
          ...authorizationHeaders(),
          "X-Worker-Control-Token": "unused-token",
        },
      },
    );

    expect(response.status).toBe(503);
  });

  test("returns a compact GeoJSON LineString track", async () => {
    const calls: Array<{ mmsi: number; hours: number }> = [];
    const track: TrackFeature = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[111, -5]] },
      properties: {
        timestamps: ["2026-09-03T00:00:00.000Z"],
        headings: [90],
        sogs: [10],
        cogs: [90],
        nav_statuses: ["Under way using engine"],
      },
    };
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: {
        ...emptyVesselQueries,
        getVesselTrack: async (mmsi, hours) => {
          calls.push({ mmsi, hours });
          return track;
        },
      },
      workerControls: emptyWorkerControls,
    });

    const response = await app.request(
      "http://localhost/api/tracks/525000000",
      { headers: authorizationHeaders() },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(track);
    expect(calls).toEqual([{ mmsi: 525000000, hours: 24 }]);
  });

  test("returns a service error when the vessel query is unavailable", async () => {
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: {
        ...emptyVesselQueries,
        getLatestVesselPositions: async () => {
          throw new Error("database offline");
        },
      },
      workerControls: emptyWorkerControls,
    });

    const response = await app.request("http://localhost/api/vessels", {
      headers: authorizationHeaders(),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The current vessel snapshot could not be loaded",
    });
  });

  test("rejects invalid track parameters before invoking the use case", async () => {
    const calls: Array<{ mmsi: number; hours: number }> = [];
    const app = createApiApp({
      authentication: testAuthentication,
      vesselQueries: {
        ...emptyVesselQueries,
        getVesselTrack: async (mmsi, hours) => {
          calls.push({ mmsi, hours });
          return emptyVesselQueries.getVesselTrack(mmsi, hours);
        },
      },
      workerControls: emptyWorkerControls,
    });

    const invalidMmsi = await app.request(
      "http://localhost/api/tracks/not-mmsi",
      { headers: authorizationHeaders() },
    );
    const shortMmsi = await app.request(
      "http://localhost/api/tracks/99999999",
      { headers: authorizationHeaders() },
    );
    const longMmsi = await app.request(
      "http://localhost/api/tracks/1000000000",
      { headers: authorizationHeaders() },
    );
    const invalidHours = await app.request(
      "http://localhost/api/tracks/525000000?hours=0",
      { headers: authorizationHeaders() },
    );
    const repeatedHours = await app.request(
      "http://localhost/api/tracks/525000000?hours=24&hours=48",
      { headers: authorizationHeaders() },
    );

    expect(invalidMmsi.status).toBe(400);
    expect(shortMmsi.status).toBe(400);
    expect(longMmsi.status).toBe(400);
    expect(invalidHours.status).toBe(400);
    expect(repeatedHours.status).toBe(400);
    expect(calls).toEqual([]);
  });
});
