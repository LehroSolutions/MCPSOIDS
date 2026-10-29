# Build Stage
FROM node:24-alpine AS builder

# Bun is the repo's authoritative package manager (packageManager: bun@1.3.14,
# .tool-versions). npm stays only as the bootstrap for installing it.
RUN npm install -g bun@1.3.14

WORKDIR /app

COPY package*.json ./
# The workspace lockfile (bun.lock) lives at the monorepo root, so it is only
# present when the build context is the repo root; honour it when it is.
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

COPY . .
RUN bun run build

# Production Stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN bun install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Create a non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

# Fail fast instead of serving filesystem tools over unauthenticated HTTP.
# Exit 78 (EX_CONFIG) so orchestrators report a config error, not a crash.
ENTRYPOINT ["/bin/sh", "-c", "test -n \"$MCP_AUTH_TOKEN\" || { echo 'MCP_AUTH_TOKEN is required: refusing to start an unauthenticated MCP server.' >&2; exit 78; }; exec \"$@\"", "--"]

EXPOSE 3000

CMD ["node", "bin/mcp-server-ref.js", "--host", "0.0.0.0"]
