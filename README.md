# AIS anomaly

A map-first AIS tracking console. A dedicated Bun ingestion worker subscribes to aisstream.io and stores vessel positions in PostgreSQL/PostGIS. The Bun API serves database snapshots and historical tracks to the React map.

## Monorepo layout

- `apps/api/` — Bun API server, independent AIS ingestion-worker entry point, PostgreSQL access, and API tests.
- `apps/web/` — Vite/React map console and its UI-only dependencies.
- `packages/api-client/` — browser-neutral API client shared by web features and future workspaces.
- `turbo.json` — Turborepo task graph for the workspace.
- `compose.yml` — local PostgreSQL/PostGIS service plus independent API, worker, and web containers.
- `Dockerfile` — multi-stage image targets for the Bun API (`api`) and static web UI (`web`).

## Run locally

1. Start the full containerized stack (PostGIS, API, and web UI):

   ```bash
   docker compose up --build
   ```

   The web UI is available at `http://localhost:5299` and the API at
   `http://localhost:3000`. Docker Compose loads API and worker configuration
   from `apps/api/.env`; a root `.env` file is not required. To run only the
   database for local development, use `docker compose up -d postgres`.

2. Create the API environment file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   # Set API_KEY and a long random WORKER_CONTROL_TOKEN.
   ```

   Both `bun run dev` and Docker Compose use this file. You may remove the
   workspace-root `.env` after moving its values here.

3. Install workspace dependencies:

   ```bash
   bun install
   ```

4. Start both workspace apps through Turborepo:

   ```bash
   bun run dev
   ```

Open `http://localhost:5299`. The map automatically refreshes the API's database snapshot every five seconds; it never opens an AIS or API WebSocket. Visit `http://localhost:5299/worker` to start or stop upstream ingestion. The worker process remains available to receive control commands; stopping disables its AIS subscription and database writes. Neither `API_KEY` nor `WORKER_CONTROL_TOKEN` is sent to or persisted in the browser. The control token is entered in the control page only for a request.

The API provides:

- `GET /health` — service health check
- `GET /api/vessels` — latest vessel positions and metadata stored in PostgreSQL
- `GET /api/worker` — persisted worker state and latest worker heartbeat
- `POST /api/worker/start` and `POST /api/worker/stop` — enable or disable ingestion; require `X-Worker-Control-Token`
- `GET /api/tracks/:mmsi?hours=24` — compact GeoJSON `LineString` historical track, with timestamp and heading arrays for playback

Set `VITE_API_ORIGIN` at web build time only when the browser cannot reach the API at the same hostname on port `3000`.

The map uses OpenStreetMap raster tiles and displays attribution in the map controls.

## Production commands

```bash
bun run build    # Build every workspace with a build task
bun run start    # Start the API and ingestion worker
bun run preview  # Preview the Vite workspace after building
```

## Verification

```bash
bun run test
```

Turborepo orchestrates the workspace tasks while Bun remains the package manager and runtime. The map prototype remains available at `/?prototype=map` for comparison with the production layout.
