# Single ARM64/amd64 image that runs identically on a Raspberry Pi and on AWS (Graviton).
# Node 23 runs the TypeScript server directly via built-in type stripping.

FROM node:23-slim AS build
WORKDIR /app
# build tools for better-sqlite3's native addon (falls back to source if no prebuild)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:23-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV RECALL_DB=/app/data/recall.db
# compiled deps (incl. native better-sqlite3) + built SPA + server/shared sources
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY server ./server
COPY src ./src
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server/index.ts"]
