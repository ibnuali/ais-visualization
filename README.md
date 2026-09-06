# AIS anomaly

A map-first AIS tracking console. Three dedicated Bun ingestion workers subscribe to non-overlapping AIS regions and store vessel positions in PostgreSQL/PostGIS. The Bun API serves database snapshots and historical tracks to the React map.

## Monorepo layout

- `apps/api/` — Bun API server, independent regional AIS ingestion-worker entry point, PostgreSQL access, and API tests.
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
   `http://localhost:3000`. The web container reverse-proxies browser `/api`
   requests to the API so Better Auth cookies remain same-origin. Docker
   Compose loads API and worker configuration from `apps/api/.env`; a root
   `.env` file is not required. To run only the database for local development,
   use `docker compose up -d postgres`.

2. Create the API environment file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   # Set API_KEY, a 32+-character BETTER_AUTH_SECRET, and a long
   # random WORKER_CONTROL_TOKEN.
   ```

   Both `bun run dev` and Docker Compose use this file. You may remove the
   workspace-root `.env` after moving its values here.

   Create users privately with the API workspace script (the public sign-up
   endpoint remains disabled):

   ```bash
   AUTH_NEW_USERNAME=operator \
   AUTH_NEW_EMAIL=operator@example.com \
   AUTH_NEW_PASSWORD='use-a-strong-password' \
   bun run auth:create-user
   ```

3. Install workspace dependencies:

   ```bash
   bun install
   ```

4. Start both workspace apps through Turborepo:

   ```bash
   bun run dev
   ```

Open `http://localhost:5299` and sign in with a user created by your private Better Auth provisioning script. Better Auth manages the session with an HttpOnly cookie; the browser does not persist the operator password or an access token. The API runs with public sign-up disabled and does not contain user credentials. The map automatically refreshes the API's database snapshot every five seconds; it never opens an AIS or API WebSocket. Visit `http://localhost:5299/worker` to inspect and control the west, central, and east ingestion workers independently. Each worker has its own AIS subscription and heartbeat; stopping one region does not stop the others. Neither `API_KEY` nor `WORKER_CONTROL_TOKEN` is sent to or persisted in the browser. The control token is entered in the control page only for a request.

The API provides (all `/api/*` routes except the Better Auth handler require a valid Better Auth session cookie or bearer token):

- `GET /health` — public service health check
- `POST /api/auth/sign-in/username` — Better Auth username/password sign-in
- `GET /api/auth/get-session` and `POST /api/auth/sign-out` — Better Auth session endpoints
- `GET /api/vessels` — latest vessel positions and metadata stored in PostgreSQL
- `GET /api/workers` — persisted state and latest heartbeat for all three regional workers
- `POST /api/workers/:workerId/start` and `POST /api/workers/:workerId/stop` — enable or disable one region; require `X-Worker-Control-Token`
- `GET /api/worker` and `POST /api/worker/start|stop` — aggregate status/control routes for all workers
- `GET /api/tracks/:mmsi?hours=24` — compact GeoJSON `LineString` historical track, with timestamp and heading arrays for playback

Better Auth creates or updates its PostgreSQL tables during API startup, so no separate auth migration command is required for this service. User accounts must be created separately with a private Better Auth provisioning script because public sign-up is disabled. The three regional subscriptions are configured as `west` (95°E–110°E), `central` (110°E–126°E), and `east` (126°E–141°E), covering the original Indonesia latitude range. Vite and nginx proxy `/api` to the API by default; set `VITE_API_ORIGIN` at web build time only when the browser must call a separately hosted API, and add that web origin to `CORS_ORIGINS`.

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
