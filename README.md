# FlowForge

FlowForge is an event-driven automation platform built for multi-region serverless environments. 
It enables users to orchestrate webhooks, conditions, data transformations, and HTTP integrations via a powerful visual node editor.

## Features
- **Visual Editor**: Node-based workflow builder (powered by React Flow).
- **Execution Engine**: Reliable, asynchronous job processing backed by BullMQ and Redis.
- **AI Workflow Generation**: Describe your automation in plain English and let AI generate the workflow graph for you (powered by Google Gemini).
- **3D Telemetry**: Monitor real-time execution health with a stunning 3D visualizer using React Three Fiber.
- **Connectors**: Triggers (Webhooks) and Actions (HTTP Requests, Data Transformations, Instagram, Email, Database Sinks).

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, DaisyUI, React Flow, React Three Fiber.
- **Backend**: Fastify, TypeScript, Prisma, PostgreSQL.
- **Job Queue**: BullMQ, Redis.
- **Infrastructure**: Docker, Docker Compose.

## Getting Started (Local Development)

### Prerequisites
- Node.js v20+
- Docker & Docker Compose (for PostgreSQL and Redis)

### Setup

1. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start Infrastructure (DB & Redis)**
   \`\`\`bash
   docker-compose up -d db redis
   \`\`\`

3. **Configure Environment Variables**
   Create `.env` files in `apps/api` and `apps/worker` with your database and redis connection strings.

4. **Run Database Migrations**
   \`\`\`bash
   npx prisma migrate dev --schema=packages/prisma/schema.prisma
   \`\`\`

5. **Start the Development Servers**
   \`\`\`bash
   npm run dev
   \`\`\`
   This will start the Web UI (`http://localhost:5173`), API server (`http://localhost:3000`), and Worker pool concurrently.

## Docker Deployment

You can run the entire stack using Docker Compose:

\`\`\`bash
docker-compose up --build -d
\`\`\`

- **Web UI**: http://localhost:8080
- **API**: http://localhost:3000

## Testing

Run the test suite across all workspaces:

\`\`\`bash
npm run test
\`\`\`

## Architecture

FlowForge uses a monorepo architecture managed by NPM workspaces.
- `apps/web`: The React-based frontend application.
- `apps/api`: The Fastify backend providing REST endpoints and Socket.IO for real-time telemetry.
- `apps/worker`: The headless BullMQ worker that executes the workflow graphs.
- `packages/workflow-engine`: The core orchestration logic and node executors.
- `packages/shared`: Shared types, Zod validation schemas, and constants.
- `packages/prisma`: Database models and Prisma client.

## Security
- API endpoints are protected using Fastify Helmet.
- Request rate limiting is configured via `@fastify/rate-limit`.
- Passwords are securely hashed with `bcryptjs`.
- Session management via JWT tokens.

