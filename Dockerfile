FROM node:20-alpine AS builder
# Prisma needs OpenSSL to pick the right query engine on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

# Copy package configurations
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/

# Install dependencies
RUN npm ci

# Copy full source
COPY . .

# Generate prisma client (schema lives at the repo root, not in a package)
RUN npx prisma generate --schema=prisma/schema.prisma

# The website needs the public API address at build time (Vite bakes it in).
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Build shared packages first, then the apps that depend on them (see the root build script)
RUN npm run build

# -------------------------
# API Image
# -------------------------
FROM node:20-alpine AS api
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@flowforge/api"]

# -------------------------
# Worker Image
# -------------------------
FROM node:20-alpine AS worker
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app ./
CMD ["npm", "run", "start", "-w", "@flowforge/worker"]

# -------------------------
# Web Image (Nginx)
# -------------------------
FROM nginx:alpine AS web
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# SPA routing fallback
RUN echo "server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

