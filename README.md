# FlowForge

FlowForge is an event-driven automation platform. It lets you connect webhooks, schedules and events to conditions, data transformations, HTTP calls, emails and database writes in a visual node editor.

## Features
- **Visual Editor**: Node-based workflow builder (powered by React Flow).
- **Execution Engine**: Asynchronous runs with automatic retries, using a job queue stored in PostgreSQL (pg-boss). No Redis needed.
- **AI Workflow Generation**: Describe your automation in plain English and let AI generate the workflow graph for you (powered by Google Gemini).
- **3D Telemetry**: Monitor real-time execution health with a 3D visualizer using React Three Fiber.
- **Connectors**: Triggers (Webhooks, Schedules, Redis streams) and Actions (HTTP Requests, AI Transformations, Email, Database writes).

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, React Flow, React Three Fiber.
- **Backend**: Fastify, TypeScript, Prisma, PostgreSQL.
- **Job Queue**: pg-boss (PostgreSQL).
- **Infrastructure**: Docker; one service plus a PostgreSQL database.

## Getting Started (Local Development)

### Prerequisites
- Node.js v22+
- A PostgreSQL database (for example `docker compose up -d db`, which needs `POSTGRES_PASSWORD` in the root `.env`)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `apps/api/.env.example` to `apps/api/.env` and fill it in.

3. **Run database migrations**
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prisma
   ```
   (On a database that already has the tables from an earlier run, baseline it once with
   `npx prisma migrate resolve --applied 0_init --schema=prisma/schema.prisma`.)

4. **Start the development servers**
   ```bash
   npm run dev
   ```
   This starts the Web UI (http://localhost:5173) and the API (http://localhost:3000), which also runs the workflows.

## Deployment

FlowForge runs as a single service (API + workflow runner + website) plus a PostgreSQL database.

- **Render + Supabase (free)**: see [DEPLOY.md](DEPLOY.md).
- **Your own server**: fill in `.env` (see `.env.example`), run `docker compose up --build -d`, and open http://localhost:3000.

## Testing

```bash
npm test
```

## Architecture

FlowForge is a monorepo managed with npm workspaces.
- `apps/web`: The React frontend.
- `apps/api`: The Fastify backend: REST endpoints, Socket.IO live updates, the workflow runner (`src/jobs`), schedules, and serving the built website.
- `packages/workflow-engine`: The core orchestration logic and step executors.
- `packages/shared`: Shared types, Zod validation schemas, and the safe condition evaluator.
- `prisma/`: Database schema (`schema.prisma`) and migrations.
- `tools/webhook-tester`: A standalone browser tool for firing signed test events at workflow endpoints (see its README).

## Security
- Security headers with Fastify Helmet, and rate limits on all endpoints (tighter on sign-in and sign-up).
- Passwords hashed with bcrypt; accounts lock after repeated failed sign-ins.
- Saved passwords and connection strings are encrypted at rest (AES-256-GCM).
- Workflow steps cannot reach the server's private network.
