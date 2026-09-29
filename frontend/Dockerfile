# template-managed (bootstrap): do not edit. Delete this line to take ownership.
# Build from the REPO ROOT (the pnpm workspace needs the root manifests):
#   docker build -f frontend/Dockerfile .
# Serves the static SPA only; /api routing belongs to the gateway (fleet).

FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS builder
# renovate: datasource=npm depName=pnpm
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY pnpm-workspace.yaml .npmrc package.json* pnpm-lock.yaml ./
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile --filter frontend
COPY project.json ./
COPY frontend/ frontend/
RUN pnpm --dir frontend build

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:6a23acdfca2b9cfbcec61419e3f1426bcbedb91362f2f19306a8567423bb4612
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
