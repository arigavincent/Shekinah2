# One public Render Free service: Node serves the admin and forwards /api to Go
# on loopback. This avoids consuming two services' shared free instance hours.
FROM golang:1.26.10-bookworm AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /shekinah-api ./cmd/api

FROM node:24-bookworm AS admin
RUN npm install --global bun@1.4.4
WORKDIR /src
COPY admin_dashboard/package.json admin_dashboard/bun.lock ./
RUN bun install --frozen-lockfile
COPY admin_dashboard/ ./
ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg poppler-utils tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY --from=api /shekinah-api /app/backend/shekinah-api
COPY backend/migrations /app/backend/migrations
COPY --from=admin /src/.output /app/admin/.output
COPY infra/render/start.sh /app/start.sh
RUN chmod 755 /app/start.sh && mkdir -p /app/backend/uploads && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 HTTP_ADDR=127.0.0.1:3000 BACKEND_API_BASE_URL=http://127.0.0.1:3000 LIVE_TRANSPORT=r2
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--", "/app/start.sh"]
