# One image runs all of FlowForge: the API, the workflow runner and the website.
# Used by Render (render.yaml) and docker-compose.yml.

FROM node:22-alpine AS builder
# Prisma needs OpenSSL to pick the right query engine on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
RUN npm ci

COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma

# Empty = the website calls the API at its own address (the API serves it).
# Set only if the website is hosted somewhere else.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# Shared packages first, then the API and the website (see the root build script).
RUN npm run build

FROM node:22-alpine AS app
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
# Apply database migrations, then start. PORT is set by the host (Render) or defaults to 3000.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node apps/api/dist/index.js"]
