# ===================================================
# Backend-Finger — Dockerfile
# Multi-stage build: deps -> build -> production
# Base: node:22-alpine
# ===================================================

# ---------- Stage 1: Build the TypeScript code ----------
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies like typescript)
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src/
RUN npx prisma generate
RUN npm run build

# ---------- Stage 2: Production dependencies ----------
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ONLY production dependencies to keep image small
RUN npm ci --omit=dev && npx prisma generate

# ---------- Stage 3: Production image ----------
FROM node:22-alpine AS runner

# Security: Use non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 express

WORKDIR /app

# Copy production node_modules
COPY --from=deps --chown=express:nodejs /app/node_modules ./node_modules

# Copy compiled javascript code from builder
COPY --from=builder --chown=express:nodejs /app/dist ./dist
# Copy static files (swagger docs, etc)
COPY --chown=express:nodejs public ./dist/public

# Copy application files
COPY --chown=express:nodejs prisma ./prisma/
COPY --chown=express:nodejs package.json ./
COPY --chown=express:nodejs fingerprint_db_local.sql ./
RUN mkdir -p exports logs && chown -R express:nodejs exports logs

# Switch to non-root user
USER express

# Expose port (runtime value from ENV)
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3333/health || exit 1

# Start the compiled server
CMD ["npm", "start"]
