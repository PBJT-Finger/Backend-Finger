# Production Dockerfile for PBJT Library Backend (Node.js)
FROM node:20-alpine AS base

WORKDIR /app

# ✅ Install wget for healthcheck
RUN apk add --no-cache wget

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# ✅ Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

# ✅ Run as non-root user
USER appuser

# Start application (correct entry point)
CMD ["node", "src/server.js"]
