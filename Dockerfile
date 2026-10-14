# 2K Courtside — Audience Builder & Segmentation Engine
# Multi-stage build for Cloud Run (standalone Next.js output).

# Stage 1: build
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN ./node_modules/.bin/next build

# Stage 2: runtime
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
# Cloud Run requires the container to listen on all interfaces inside the sandbox.
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
# Reference catalog JSON is only used by the seed scripts; the app reads Spanner.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
