FROM node:20-alpine
WORKDIR /app
COPY ../../package*.json ./
COPY ../../packages ./packages
COPY ../../apps/api ./apps/api
RUN npm ci
RUN npm run build --workspace=@flowforge/api
CMD ["npm", "run", "start", "-w", "@flowforge/api"]

