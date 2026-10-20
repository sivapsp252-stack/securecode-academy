# Deployable image (Render / Railway / Fly.io / any VPS).
# NOTE: inside a PaaS container Docker-in-Docker is normally unavailable, so this image runs the
# sandbox in "local" mode (Python child process + audit-hook guard + CPU/memory rlimits).
# For the strongest isolation run on a VM with Docker and SANDBOX_MODE=docker (see docs/SANDBOX_DESIGN.md).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY client/package*.json client/
RUN npm --prefix client install
COPY client client
RUN npm --prefix client run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json server/
RUN npm --prefix server install --omit=dev && npm --prefix server rebuild better-sqlite3 --build-from-source
COPY server server
COPY challenges challenges
COPY content content
COPY --from=build /app/client/dist client/dist
ENV NODE_ENV=production SANDBOX_MODE=local PYTHON_BIN=python3 PORT=4000 DB_PATH=/data/securecode.db
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 4000
CMD ["node", "server/src/index.js"]
