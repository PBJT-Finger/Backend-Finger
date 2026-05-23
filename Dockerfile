# ===================================================
# Backend-Finger — Dockerfile
# Multi-stage build: deps → build → production
# Base: node:22-alpine (minimal attack surface)
# ===================================================

# ---------- Stage 1: Install dependencies ----------
FROM node:22-alpine AS deps

# Install OS-level deps needed by some npm packages
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files first (Docker layer cache optimization)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install production deps only + generate Prisma client
RUN npm ci --omit=dev && npx prisma generate

# ---------- Stage 2: Production image ----------
FROM node:22-alpine AS runner

# Security: Use non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 express

WORKDIR /app

# Copy installed node_modules from deps stage (includes .prisma/client)
COPY --from=deps --chown=express:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=express:nodejs prisma ./prisma/
COPY --chown=express:nodejs src ./src/
COPY --chown=express:nodejs package.json ./

# Create required directories (exports + logs) before switching to non-root user
RUN mkdir -p exports logs && chown -R express:nodejs exports logs

# Switch to non-root user
USER express

# Expose port (runtime value from ENV)
EXPOSE 3333

# Health check — calls /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3333/health || exit 1

# Entrypoint: start server directly
# NOTE: prisma migrate deploy is now run ONCE in CI (backend.yml deploy step)
# before the container is recreated — keeping startup fast and predictable.
CMD ["node", "src/server.js"]
