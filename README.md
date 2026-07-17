# CTRL_SHE

Foxly is a passkey-based authentication platform implemented as an npm workspace.

## Workspaces

- `apps/foxly-frontend`: Next.js 14 App Router frontend
- `apps/foxly-backend`: Express + TypeScript API
- `packages/shared-types`: shared TypeScript contract for Foxly and future Tally integrations
- `apps/tally-frontend` and `apps/tally-backend`: placeholders, intentionally out of scope

The Stitch export used as the visual source is preserved in `stitch_export/`.

## Run Foxly

Install dependencies from the repo root:

```bash
npm install
```

Start the backend:

```bash
npm run dev:foxly:backend
```

Start the frontend in another terminal:

```bash
npm run dev:foxly:frontend
```

Defaults:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

The backend includes a Postgres migration in `apps/foxly-backend/migrations/001_init.sql`. For hackathon/demo use it falls back to in-memory stores when Postgres or Redis are unavailable.
