# Standalone specmesh MCP server (FR-020) — self-hosted by the consumer, over Streamable HTTP.
# Root repo path(s) are supplied via a mounted volume; this image never bakes in or clones a checkout.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run compile

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/out ./out
COPY README.md ./

ENV SPECMESH_MCP_TRANSPORT=http
ENV SPECMESH_MCP_PORT=3000
EXPOSE 3000

ENTRYPOINT ["node", "out/mcpServer/server.js"]
