import { describe, expect, test } from "bun:test";
import type { RawData } from "ws";
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
    properties: { timestamps: [], headings: [] },
  }),
};

const emptyWorkerControls: WorkerControls = {
  getStatus: async () => testWorkerControl,
  enable: async () => ({ ...testWorkerControl, isEnabled: true }),
  disable: async () => testWorkerControl,
};

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
        getWorkerControl: async () => control,
        setWorkerEnabled: async (isEnabled) => ({
          ...control,
          isEnabled,
        }),
        setWorkerState: async (workerState) => {
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

describe("HTTP API adapter", () => {
  test("reports service health", async () => {
    const app = createApiApp();
    const response = await app.request("http://localhost/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
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
      vesselQueries: {
        ...emptyVesselQueries,
        getLatestVesselPositions: async () => vessels,
      },
      workerControls: emptyWorkerControls,
    });

    const response = await app.request("http://localhost/api/vessels");

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

  test("reports worker state and requires a token for start and stop", async () => {
    const requestedStates: boolean[] = [];
    let workerControl = { ...testWorkerControl };
    const app = createApiApp({
      vesselQueries: emptyVesselQueries,
      workerControls: {
        getStatus: async () => workerControl,
        enable: async () => {
          requestedStates.push(true);
          workerControl = { ...workerControl, isEnabled: true };
          return workerControl;
        },
        disable: async () => {
          requestedStates.push(false);
          workerControl = { ...workerControl, isEnabled: false };
          return workerControl;
        },
      },
      workerControlToken: "test-control-token",
    });

    const statusResponse = await app.request("http://localhost/api/worker");
    const unauthorizedResponse = await app.request(
      "http://localhost/api/worker/start",
      { method: "POST" },
    );
    const startResponse = await app.request(
      "http://localhost/api/worker/start",
      {
        method: "POST",
        headers: { "X-Worker-Control-Token": "test-control-token" },
      },
    );
    const stopResponse = await app.request("http://localhost/api/worker/stop", {
      method: "POST",
      headers: { "X-Worker-Control-Token": "test-control-token" },
    });

    expect(await statusResponse.json()).toEqual({
      is_enabled: false,
      worker_state: "stopped",
      updated_at: "2026-09-03T00:00:00.000Z",
      last_heartbeat: "2026-09-03T00:00:00.000Z",
      control_configured: true,
    });
    expect(unauthorizedResponse.status).toBe(401);
    expect(startResponse.status).toBe(200);
    expect(stopResponse.status).toBe(200);
    expect(requestedStates).toEqual([true, false]);
  });

  test("returns a compact GeoJSON LineString track", async () => {
    const calls: Array<{ mmsi: number; hours: number }> = [];
    const track: TrackFeature = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[111, -5]] },
      properties: {
        timestamps: ["2026-09-03T00:00:00.000Z"],
        headings: [90],
      },
    };
    const app = createApiApp({
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
      "http://localhost/api/tracks/525000000?hours=24",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(track);
    expect(calls).toEqual([{ mmsi: 525000000, hours: 24 }]);
  });

  test("returns a service error when the vessel query is unavailable", async () => {
    const app = createApiApp({
      vesselQueries: {
        ...emptyVesselQueries,
        getLatestVesselPositions: async () => {
          throw new Error("database offline");
        },
      },
      workerControls: emptyWorkerControls,
    });

    const response = await app.request("http://localhost/api/vessels");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The current vessel snapshot could not be loaded",
    });
  });

  test("rejects invalid track parameters before invoking the use case", async () => {
    const app = createApiApp({
      vesselQueries: emptyVesselQueries,
      workerControls: emptyWorkerControls,
    });

    const invalidMmsi = await app.request(
      "http://localhost/api/tracks/not-mmsi",
    );
    const invalidHours = await app.request(
      "http://localhost/api/tracks/525000000?hours=0",
    );

    expect(invalidMmsi.status).toBe(400);
    expect(invalidHours.status).toBe(400);
  });
});
