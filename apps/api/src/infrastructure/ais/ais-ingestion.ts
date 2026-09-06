import WebSocket from "ws";
import type { RawData } from "ws";
import type { AsyncHandler, Ingestion } from "../../application/ports.ts";
import type {
  PositionReport,
  ShipStaticData,
  VesselClass,
} from "../../domain/models.ts";

const AIS_STREAM_URL = "wss://stream.aisstream.io/v0/stream";
// Covers Indonesia's maritime extent from the Indian Ocean to Papua.
type BoundingBox = [[number, number], [number, number]];
const DEFAULT_BOUNDING_BOXES: BoundingBox[] = [
  [
    [-11, 95],
    [6, 141],
  ],
];
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

const NAVIGATION_STATUS_NAMES = [
  "Under way using engine",
  "At anchor",
  "Not under command",
  "Restricted maneuverability",
  "Constrained by her draught",
  "Moored",
  "Aground",
  "Engaged in fishing",
  "Under way sailing",
] as const;

type AisValue = string | number | boolean | null | AisObject | AisValue[];
interface AisObject {
  [key: string]: AisValue;
}
type JsonObject = AisObject;

type RawPositionReport = {
  timestamp: string;
  mmsi: number | null;
  latitude: number | null;
  longitude: number | null;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  rot: number | null;
  navStatus: string | null;
  vesselClass: VesselClass;
};

type RawStaticData = Omit<ShipStaticData, "mmsi"> & { mmsi: number | null };

export interface AisSocket {
  on(event: "open" | "close", listener: () => void): AisSocket;
  on(event: "message", listener: (data: RawData | string) => void): AisSocket;
  on(event: "error", listener: (error: Error) => void): AisSocket;
  send(payload: string): void;
  close(code?: number, reason?: string): void;
}

export interface AisLogger {
  error(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
}

export interface AisIngestion extends Ingestion {
  getSocket?(): AisSocket | null;
}

export interface AisIngestionOptions {
  apiKey?: string;
  onPosition?: AsyncHandler<PositionReport>;
  onMetadata?: AsyncHandler<ShipStaticData>;
  streamUrl?: string;
  boundingBoxes?: BoundingBox[];
  socketFactory?: (url: string) => AisSocket;
  logger?: AisLogger;
}

function createWebSocket(url: string): AisSocket {
  // SAFETY: ingestion only uses the event, send, and close methods shared by ws.WebSocket.
  return new WebSocket(url);
}

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function firstDefined(value: unknown, keys: readonly string[]): AisValue {
  const object = asObject(value);
  if (!object) {
    return null;
  }

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  return null;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function toNumberOrString(value: AisValue): number | string | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toUsableMmsi(value: unknown): number | null {
  const mmsi = toFiniteNumber(value);
  return mmsi !== null &&
    Number.isInteger(mmsi) &&
    mmsi > 0 &&
    mmsi <= 2147483647
    ? mmsi
    : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseAisMessage(rawMessage: RawData | string): JsonObject | null {
  try {
    return asObject(JSON.parse(rawMessage.toString()));
  } catch {
    return null;
  }
}

function getPositionReport(
  position: JsonObject,
  vesselClass: VesselClass,
  timestamp: string,
): RawPositionReport {
  const rawNavigationStatus = firstDefined(position, ["NavigationStatus"]);
  const navigationStatusCode = toFiniteNumber(rawNavigationStatus);
  const navStatus =
    navigationStatusCode === null
      ? trimOrNull(rawNavigationStatus)
      : (NAVIGATION_STATUS_NAMES[navigationStatusCode] ??
        String(rawNavigationStatus));

  return {
    timestamp,
    mmsi: toFiniteNumber(firstDefined(position, ["UserID"])),
    latitude: toFiniteNumber(firstDefined(position, ["Latitude"])),
    longitude: toFiniteNumber(firstDefined(position, ["Longitude"])),
    sog: toFiniteNumber(firstDefined(position, ["Sog", "SOG"])),
    cog: toFiniteNumber(firstDefined(position, ["Cog", "COG"])),
    heading: toFiniteNumber(firstDefined(position, ["TrueHeading"])),
    rot: toFiniteNumber(
      firstDefined(position, ["RateOfTurn", "RateOfTurnValue"]),
    ),
    navStatus,
    vesselClass,
  };
}

function getStaticData(ship: JsonObject): RawStaticData {
  const dimensions = asObject(ship.Dimension);

  return {
    mmsi: toFiniteNumber(firstDefined(ship, ["UserID"])),
    shipName: trimOrNull(firstDefined(ship, ["Name", "ShipName"])),
    shipType: toFiniteNumber(firstDefined(ship, ["Type", "ShipType"])),
    callSign: trimOrNull(firstDefined(ship, ["CallSign"])),
    imo: toNumberOrString(firstDefined(ship, ["ImoNumber", "IMONumber"])),
    destination: trimOrNull(firstDefined(ship, ["Destination"])),
    dimBow:
      toFiniteNumber(firstDefined(ship, ["DimensionToBow"])) ??
      toFiniteNumber(firstDefined(dimensions, ["A"])),
    dimStern:
      toFiniteNumber(firstDefined(ship, ["DimensionToStern"])) ??
      toFiniteNumber(firstDefined(dimensions, ["B"])),
    dimPort:
      toFiniteNumber(firstDefined(ship, ["DimensionToPort"])) ??
      toFiniteNumber(firstDefined(dimensions, ["C"])),
    dimStarboard:
      toFiniteNumber(firstDefined(ship, ["DimensionToStarboard"])) ??
      toFiniteNumber(firstDefined(dimensions, ["D"])),
  };
}

function getPositionMetadata(
  metadata: unknown,
  fallbackMmsi: number,
): ShipStaticData | null {
  const shipName = trimOrNull(firstDefined(metadata, ["ShipName", "Name"]));
  if (!shipName) {
    return null;
  }

  return {
    mmsi:
      toUsableMmsi(firstDefined(metadata, ["MMSI", "MMSI_String"])) ??
      fallbackMmsi,
    shipName,
  };
}

function isUsablePosition(
  position: RawPositionReport,
): position is PositionReport {
  return (
    position.mmsi !== null &&
    position.latitude !== null &&
    position.longitude !== null &&
    toUsableMmsi(position.mmsi) !== null &&
    position.latitude >= -90 &&
    position.latitude <= 90 &&
    position.longitude >= -180 &&
    position.longitude <= 180
  );
}

export function createAisIngestion({
  apiKey,
  onPosition,
  onMetadata,
  streamUrl = AIS_STREAM_URL,
  boundingBoxes = DEFAULT_BOUNDING_BOXES,
  socketFactory = createWebSocket,
  logger = console,
}: AisIngestionOptions = {}): AisIngestion {
  if (!apiKey) {
    throw new Error("API_KEY is required to start AIS ingestion");
  }

  if (typeof onPosition !== "function" || typeof onMetadata !== "function") {
    throw new Error("AIS ingestion requires position and metadata handlers");
  }

  let socket: AisSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  let stopped = false;

  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) {
      return;
    }

    const delay = reconnectDelay;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    logger.warn(`AIS stream reconnecting in ${delay}ms`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const processMessage = async (
    rawMessage: RawData | string,
  ): Promise<void> => {
    const aisMessage = parseAisMessage(rawMessage);
    if (!aisMessage) {
      logger.warn("AIS stream returned an invalid JSON message");
      return;
    }

    const messageType = aisMessage.MessageType;
    if (typeof messageType !== "string") {
      return;
    }

    const messages = asObject(aisMessage.Message);
    const payload = asObject(messages?.[messageType]);
    const timestamp = new Date().toISOString();

    if (
      (messageType === "PositionReport" ||
        messageType === "StandardClassBPositionReport") &&
      payload
    ) {
      const vesselClass: VesselClass =
        messageType === "PositionReport" ? "A" : "B";
      const position = getPositionReport(payload, vesselClass, timestamp);
      if (isUsablePosition(position)) {
        await onPosition(position);
        const metadata = getPositionMetadata(
          aisMessage.MetaData,
          position.mmsi,
        );
        if (metadata) {
          await onMetadata(metadata);
        }
      }
      return;
    }

    if (messageType === "ShipStaticData" && payload) {
      const metadata = getStaticData(payload);
      const mmsi = toUsableMmsi(metadata.mmsi);
      if (mmsi !== null) {
        await onMetadata({ ...metadata, mmsi });
      }
    }
  };

  function connect(): void {
    if (stopped) {
      return;
    }

    let nextSocket: AisSocket;
    try {
      nextSocket = socketFactory(streamUrl);
    } catch (error) {
      logger.error(
        "Could not create AIS stream socket:",
        getErrorMessage(error),
      );
      scheduleReconnect();
      return;
    }

    socket = nextSocket;

    nextSocket.on("open", () => {
      if (socket !== nextSocket || stopped) {
        return;
      }

      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      try {
        nextSocket.send(
          JSON.stringify({
            APIkey: apiKey,
            BoundingBoxes: boundingBoxes,
          }),
        );
        logger.info("AIS stream connected; subscription sent");
      } catch (error) {
        logger.error("AIS subscription failed:", getErrorMessage(error));
        nextSocket.close();
      }
    });

    nextSocket.on("message", (data) => {
      if (socket !== nextSocket || stopped) {
        return;
      }

      void processMessage(data).catch((error: unknown) => {
        logger.error("AIS message processing failed:", getErrorMessage(error));
      });
    });

    nextSocket.on("error", (error: Error) => {
      if (socket === nextSocket && !stopped) {
        logger.error("AIS stream error:", error.message);
      }
    });

    nextSocket.on("close", () => {
      if (socket !== nextSocket) {
        return;
      }

      socket = null;
      if (!stopped) {
        scheduleReconnect();
      }
    });
  }

  const stop = (): void => {
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const activeSocket = socket;
    socket = null;
    if (activeSocket) {
      activeSocket.close(1000, "Server shutting down");
    }
  };

  connect();

  return {
    stop,
    getSocket: () => socket,
  };
}
