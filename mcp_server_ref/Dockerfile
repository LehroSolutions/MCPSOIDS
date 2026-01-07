# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Create a non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp
USER mcp

EXPOSE 3000

CMD ["node", "bin/mcp-server-ref.js", "--host", "0.0.0.0"]
