# Memory

## Project Overview

See @README.md for the product overview and @package.json for the authoritative Bun and Turborepo scripts.

This project has two runtime surfaces:

- The Vite/React UI in `apps/web/src/App.tsx` reads API snapshots in the browser and displays the latest vessel data plus an in-session activity log.
- `apps/api/index.ts` is the Bun API entry point; it reads `DATABASE_URL` from `apps/api/.env` (with the workspace root `.env` fallback) and serves database-backed vessel data.
- `apps/api/worker.ts` is the independent Bun ingestion worker; it reads `API_KEY` and `DATABASE_URL` from the same environment files and writes AIS data to PostgreSQL.

## Code Style Guidelines

- Use descriptive variable names.
- Follow existing patterns in the codebase.
- Extract complex conditions into meaningful boolean variables.
- Keep credentials out of logs and client-side persistence.
- Use Bun for dependency management and project commands.

## Architecture Notes

- `apps/web/src/styles.css` owns the UI tokens, responsive layout, and interaction states; keep new UI styling token-based.
- The browser UI accepts secure `wss://` endpoints and retains the API key in memory only. The base URL may be remembered locally.
- Keep the UI and ingestion worker independent unless a task explicitly asks for a server integration.
- `turbo.json` owns task orchestration; `bun.lock` is the single package-manager lockfile. Do not add npm or pnpm lockfiles.

## Common Workflows

- Install dependencies: `bun install`
- Run both workspaces in development: `bun run dev`
- Build all buildable workspaces: `bun run build`
- Preview the Vite app: `bun run preview`
- Run the ingestion worker: `bun run start`
- Run the smoke verification: `bun run test`

A change is ready when the relevant Bun/Turbo command completes successfully and the responsive UI still works at 320px, 375px, 414px, and 768px widths.
