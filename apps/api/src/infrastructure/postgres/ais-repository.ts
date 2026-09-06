import { Pool } from "pg";
import type { QueryResultRow } from "pg";
import type {
  VesselDataWriter,
  VesselSnapshotReader,
  WorkerControlStore,
} from "../../application/ports.ts";
import {
  WORKER_IDS,
  type PositionReport,
  type ShipStaticData,
  type TrackFeature,
  type VesselSnapshot,
  type WorkerControl,
  type WorkerId,
  type WorkerState,
} from "../../domain/models.ts";
import { WORKER_REGIONS } from "../../domain/worker-regions.ts";

export interface DatabaseLifecycle {
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export type AisRepository = DatabaseLifecycle &
  VesselSnapshotReader &
  WorkerControlStore &
  VesselDataWriter;

export interface PostgresAisRepositoryOptions {
  connectionString?: string;
}

type DatabaseTimestamp = Date | string;

interface VesselSnapshotRow extends QueryResultRow {
  mmsi: number;
  timestamp: DatabaseTimestamp;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  rot: number | null;
  nav_status: string | null;
  vessel_class: "A" | "B";
  ship_name: string | null;
  ship_type: number | null;
  call_sign: string | null;
  imo: string | null;
  destination: string | null;
}

interface WorkerControlRow extends QueryResultRow {
  worker_id: WorkerId;
  is_enabled: boolean;
  worker_state: WorkerState;
  updated_at: DatabaseTimestamp;
  last_heartbeat: DatabaseTimestamp | null;
}

interface TrackRow extends QueryResultRow {
  timestamp: DatabaseTimestamp;
  latitude: number;
  longitude: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  nav_status: string | null;
}

function asRequiredIsoTimestamp(value: DatabaseTimestamp): string {
  return value instanceof Date ? value.toISOString() : value;
}

function asOptionalIsoTimestamp(
  value: DatabaseTimestamp | null,
): string | null {
  return value instanceof Date ? value.toISOString() : value;
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}

function toVesselSnapshot(row: VesselSnapshotRow): VesselSnapshot {
  return {
    mmsi: row.mmsi,
    timestamp: asRequiredIsoTimestamp(row.timestamp),
    latitude: row.latitude,
    longitude: row.longitude,
    sog: row.sog,
    cog: row.cog,
    heading: row.heading,
    rot: row.rot,
    navigationStatus: row.nav_status,
    vesselClass: row.vessel_class,
    shipName: row.ship_name,
    shipType: row.ship_type,
    callSign: row.call_sign,
    imo: row.imo,
    destination: row.destination,
  };
}

function toWorkerControl(row: WorkerControlRow): WorkerControl {
  return {
    workerId: row.worker_id,
    isEnabled: row.is_enabled,
    workerState: row.worker_state,
    updatedAt: asRequiredIsoTimestamp(row.updated_at),
    lastHeartbeat: asOptionalIsoTimestamp(row.last_heartbeat),
  };
}

export function createPostgresAisRepository({
  connectionString,
}: PostgresAisRepositoryOptions = {}): AisRepository {
  const pool = new Pool({ connectionString });

  const initialize = async (): Promise<void> => {
    const client = await pool.connect();
    let hasSchemaLock = false;

    try {
      await client.query("SELECT 1");
      await client.query(
        "SELECT pg_advisory_lock(hashtext('ais-anomaly-schema-init'))",
      );
      hasSchemaLock = true;
      await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
      await client.query(
        "CREATE SCHEMA IF NOT EXISTS ais AUTHORIZATION CURRENT_USER",
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS ais.vessel_positions (
          id            BIGSERIAL PRIMARY KEY,
          timestamp     TIMESTAMPTZ NOT NULL,
          mmsi          INTEGER NOT NULL,
          latitude      DOUBLE PRECISION NOT NULL,
          longitude     DOUBLE PRECISION NOT NULL,
          sog           DOUBLE PRECISION,
          cog           DOUBLE PRECISION,
          heading       DOUBLE PRECISION,
          rot           DOUBLE PRECISION,
          nav_status    TEXT,
          vessel_class  TEXT NOT NULL DEFAULT 'A',
          geom          geometry(Point, 4326),
          ingest_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_positions_timestamp
          ON ais.vessel_positions (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_positions_mmsi
          ON ais.vessel_positions (mmsi);
        CREATE INDEX IF NOT EXISTS idx_positions_mmsi_ts
          ON ais.vessel_positions (mmsi, timestamp DESC);
      `);

      await client.query(`
        ALTER TABLE ais.vessel_positions
          ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326)
      `);

      await client.query(`
        UPDATE ais.vessel_positions
           SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
         WHERE geom IS NULL
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_positions_geom
          ON ais.vessel_positions USING GIST (geom)
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ais.ship_static_data (
          mmsi          INTEGER PRIMARY KEY,
          ship_name     TEXT,
          ship_type     INTEGER,
          call_sign     TEXT,
          imo           TEXT,
          destination   TEXT,
          dim_bow       INTEGER,
          dim_stern     INTEGER,
          dim_port      INTEGER,
          dim_starboard INTEGER,
          first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const workerControlColumns = await client.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'ais'
            AND table_name = 'ingestion_worker_control'
        `,
      );
      const hasWorkerControlTable = workerControlColumns.rows.length > 0;
      const hasWorkerIdColumn = workerControlColumns.rows.some(
        (row) => row.column_name === "worker_id",
      );

      if (hasWorkerControlTable && !hasWorkerIdColumn) {
        await client.query(`
          ALTER TABLE ais.ingestion_worker_control
            ADD COLUMN worker_id TEXT
        `);
        await client.query(`
          UPDATE ais.ingestion_worker_control
             SET worker_id = CASE id
               WHEN 1 THEN 'west'
               WHEN 2 THEN 'central'
               WHEN 3 THEN 'east'
             END
           WHERE worker_id IS NULL
        `);
        await client.query(`
          ALTER TABLE ais.ingestion_worker_control
            ALTER COLUMN worker_id SET NOT NULL
        `);
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS ais.ingestion_worker_control (
          id             SMALLINT PRIMARY KEY,
          worker_id      TEXT NOT NULL UNIQUE,
          is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
          worker_state   TEXT NOT NULL DEFAULT 'stopped'
                         CHECK (worker_state IN ('running', 'stopped')),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_heartbeat TIMESTAMPTZ
        );
      `);
      await client.query(`
        ALTER TABLE ais.ingestion_worker_control
          DROP CONSTRAINT IF EXISTS ingestion_worker_control_id_check
      `);
      await client.query(`
        ALTER TABLE ais.ingestion_worker_control
          DROP CONSTRAINT IF EXISTS ingestion_worker_control_worker_id_check
      `);
      await client.query(`
        ALTER TABLE ais.ingestion_worker_control
          ADD CONSTRAINT ingestion_worker_control_worker_id_check
          CHECK (worker_id IN ('west', 'central', 'east'))
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ingestion_worker_control_worker_id_key
          ON ais.ingestion_worker_control (worker_id)
      `);

      const defaultWorkerEnabledResult = await client.query<{
        is_enabled: boolean;
      }>(`
        SELECT is_enabled
        FROM ais.ingestion_worker_control
        WHERE worker_id = 'west'
        LIMIT 1
      `);
      const defaultWorkerEnabled =
        defaultWorkerEnabledResult.rows[0]?.is_enabled ?? true;

      for (const [index, region] of WORKER_REGIONS.entries()) {
        await client.query(
          `
            INSERT INTO ais.ingestion_worker_control (id, worker_id, is_enabled)
            VALUES ($1, $2, $3)
            ON CONFLICT (worker_id) DO NOTHING
          `,
          [index + 1, region.id, defaultWorkerEnabled],
        );
      }

      await client.query(`
        CREATE OR REPLACE VIEW ais.latest_vessel_position AS
        SELECT DISTINCT ON (vp.mmsi)
          vp.mmsi,
          vp.timestamp,
          vp.latitude,
          vp.longitude,
          vp.sog,
          vp.cog,
          vp.heading,
          vp.rot,
          vp.nav_status,
          vp.vessel_class,
          ssd.ship_name,
          ssd.ship_type,
          ssd.call_sign,
          ssd.imo,
          ssd.destination
        FROM ais.vessel_positions vp
        LEFT JOIN ais.ship_static_data ssd ON vp.mmsi = ssd.mmsi
        ORDER BY vp.mmsi, vp.timestamp DESC, vp.id DESC
      `);

      console.log("Connected to PostgreSQL; AIS tables and indexes are ready");
    } finally {
      try {
        if (hasSchemaLock) {
          await client.query(
            "SELECT pg_advisory_unlock(hashtext('ais-anomaly-schema-init'))",
          );
        }
      } finally {
        client.release();
      }
    }
  };

  const getLatestVesselPositions = async (): Promise<VesselSnapshot[]> => {
    const result = await pool.query<VesselSnapshotRow>(`
      SELECT
        mmsi,
        timestamp,
        latitude,
        longitude,
        sog,
        cog,
        heading,
        rot,
        nav_status,
        vessel_class,
        ship_name,
        ship_type,
        call_sign,
        imo,
        destination
      FROM ais.latest_vessel_position
      ORDER BY mmsi
    `);

    return result.rows.map(toVesselSnapshot);
  };

  const getWorkerControls = async (): Promise<WorkerControl[]> => {
    const result = await pool.query<WorkerControlRow>(`
      SELECT worker_id, is_enabled, worker_state, updated_at, last_heartbeat
      FROM ais.ingestion_worker_control
      ORDER BY id
    `);

    return result.rows.map(toWorkerControl);
  };

  const getWorkerControl = async (
    workerId: WorkerId,
  ): Promise<WorkerControl> => {
    const result = await pool.query<WorkerControlRow>(
      `
        SELECT worker_id, is_enabled, worker_state, updated_at, last_heartbeat
        FROM ais.ingestion_worker_control
        WHERE worker_id = $1
      `,
      [workerId],
    );

    return toWorkerControl(
      requireRow(result.rows[0], `AIS worker ${workerId} is not initialized`),
    );
  };

  const setWorkerEnabled = async (
    workerId: WorkerId,
    isEnabled: boolean,
  ): Promise<WorkerControl> => {
    const result = await pool.query<WorkerControlRow>(
      `
        UPDATE ais.ingestion_worker_control
        SET is_enabled = $1,
            updated_at = NOW()
        WHERE worker_id = $2
        RETURNING worker_id, is_enabled, worker_state, updated_at, last_heartbeat
      `,
      [isEnabled, workerId],
    );

    return toWorkerControl(
      requireRow(result.rows[0], `AIS worker ${workerId} is not initialized`),
    );
  };

  const setAllWorkerEnabled = async (isEnabled: boolean): Promise<void> => {
    const client = await pool.connect();
    let isTransactionOpen = false;

    try {
      await client.query("BEGIN");
      isTransactionOpen = true;

      const result = await client.query(
        `
          UPDATE ais.ingestion_worker_control
          SET is_enabled = $1,
              updated_at = NOW()
          WHERE worker_id = ANY($2::text[])
        `,
        [isEnabled, [...WORKER_IDS]],
      );

      if (result.rowCount !== WORKER_IDS.length) {
        throw new Error("All AIS workers must be initialized before control");
      }

      await client.query("COMMIT");
      isTransactionOpen = false;
    } catch (error) {
      if (isTransactionOpen) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  };

  const setWorkerState = async (
    workerId: WorkerId,
    workerState: WorkerState,
  ): Promise<WorkerControl> => {
    const result = await pool.query<WorkerControlRow>(
      `
        UPDATE ais.ingestion_worker_control
        SET worker_state = $1,
            last_heartbeat = NOW()
        WHERE worker_id = $2
        RETURNING worker_id, is_enabled, worker_state, updated_at, last_heartbeat
      `,
      [workerState, workerId],
    );

    return toWorkerControl(
      requireRow(result.rows[0], `AIS worker ${workerId} is not initialized`),
    );
  };

  const getVesselTrack = async (
    mmsi: number,
    hours: number,
  ): Promise<TrackFeature> => {
    const result = await pool.query<TrackRow>(
      `
        SELECT timestamp, latitude, longitude, sog, cog, heading, nav_status
        FROM ais.vessel_positions
        WHERE mmsi = $1
          AND timestamp >= NOW() - ($2::integer * INTERVAL '1 hour')
        ORDER BY timestamp ASC, id ASC
      `,
      [mmsi, hours],
    );

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: result.rows.map((row): [number, number] => [
          row.longitude,
          row.latitude,
        ]),
      },
      properties: {
        timestamps: result.rows.map((row) =>
          asRequiredIsoTimestamp(row.timestamp),
        ),
        headings: result.rows.map((row) => row.heading),
        sogs: result.rows.map((row) => row.sog),
        cogs: result.rows.map((row) => row.cog),
        nav_statuses: result.rows.map((row) => row.nav_status),
      },
    };
  };

  const storePosition = async ({
    timestamp,
    mmsi,
    latitude,
    longitude,
    sog,
    cog,
    heading,
    rot,
    navStatus,
    vesselClass,
  }: PositionReport): Promise<void> => {
    if (vesselClass === "B") {
      await pool.query(
        `
          INSERT INTO ais.vessel_positions
            (timestamp, mmsi, latitude, longitude, sog, cog, heading, vessel_class, geom)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'B', ST_SetSRID(ST_MakePoint($4, $3), 4326))
        `,
        [timestamp, mmsi, latitude, longitude, sog, cog, heading],
      );
      return;
    }

    await pool.query(
      `
        INSERT INTO ais.vessel_positions
          (timestamp, mmsi, latitude, longitude, sog, cog, heading, rot, nav_status, vessel_class, geom)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'A', ST_SetSRID(ST_MakePoint($4, $3), 4326))
      `,
      [timestamp, mmsi, latitude, longitude, sog, cog, heading, rot, navStatus],
    );
  };

  const storeShipStaticData = async ({
    mmsi,
    shipName,
    shipType,
    callSign,
    imo,
    destination,
    dimBow,
    dimStern,
    dimPort,
    dimStarboard,
  }: ShipStaticData): Promise<void> => {
    await pool.query(
      `
        INSERT INTO ais.ship_static_data AS existing
          (mmsi, ship_name, ship_type, call_sign, imo, destination, dim_bow, dim_stern, dim_port, dim_starboard, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (mmsi) DO UPDATE SET
          ship_name     = COALESCE(EXCLUDED.ship_name, existing.ship_name),
          ship_type     = COALESCE(EXCLUDED.ship_type, existing.ship_type),
          call_sign     = COALESCE(EXCLUDED.call_sign, existing.call_sign),
          imo           = COALESCE(EXCLUDED.imo, existing.imo),
          destination   = COALESCE(EXCLUDED.destination, existing.destination),
          dim_bow       = COALESCE(EXCLUDED.dim_bow, existing.dim_bow),
          dim_stern     = COALESCE(EXCLUDED.dim_stern, existing.dim_stern),
          dim_port      = COALESCE(EXCLUDED.dim_port, existing.dim_port),
          dim_starboard = COALESCE(EXCLUDED.dim_starboard, existing.dim_starboard),
          updated_at    = NOW()
      `,
      [
        mmsi,
        shipName ?? null,
        shipType ?? null,
        callSign ?? null,
        imo ?? null,
        destination ?? null,
        dimBow ?? null,
        dimStern ?? null,
        dimPort ?? null,
        dimStarboard ?? null,
      ],
    );
  };

  return {
    initialize,
    close: () => pool.end(),
    getLatestVesselPositions,
    getVesselTrack,
    getWorkerControls,
    getWorkerControl,
    setWorkerEnabled,
    setAllWorkerEnabled,
    setWorkerState,
    storePosition,
    storeShipStaticData,
  };
}
