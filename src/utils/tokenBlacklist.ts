/**
 * src/utils/tokenBlacklist.ts — JWT Token Revocation
 *
 * Current implementation: in-memory Map fallback.
 *
 * Risk register (from masterplan):
 *   Redis disabled → token revocation does not survive process restart.
 *   This is an ACCEPTED trade-off for Phase 1 — tokens still expire naturally
 *   via JWT `exp` claim. Full Redis integration is a Sprint 5+ task.
 *
 * When Redis is connected, replace the in-memory Map with ioredis setex/exists.
 * The interface contract (addToBlacklist, isBlacklisted) must NOT change.
 */

import logger from './logger';

// ─── In-Memory Fallback Store ─────────────────────────────────────────────────

/**
 * Token → expiry timestamp (ms).
 * We store expiry so that the map can be pruned without Redis TTL.
 *
 * Trade-off: This map grows unbounded until process restart. Acceptable for
 * short-lived tokens (15m access tokens). Long-lived refresh tokens require
 * Redis for correctness in production.
 */
const inMemoryBlacklist = new Map<string, number>();

/** Prune expired entries to prevent memory leak on long-running processes. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [token, expiry] of inMemoryBlacklist.entries()) {
    if (expiry < now) {
      inMemoryBlacklist.delete(token);
    }
  }
}

// Prune every 5 minutes
setInterval(pruneExpired, 5 * 60 * 1000).unref();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Adds a token to the revocation list until its natural expiry.
 * @param token         - The raw JWT string (never log this)
 * @param expirySeconds - Seconds until the token naturally expires (from JWT `exp`)
 */
export async function addToBlacklist(token: string, expirySeconds: number): Promise<void> {
  const expiryMs = Date.now() + expirySeconds * 1000;
  inMemoryBlacklist.set(token, expiryMs);
  logger.info('Token added to revocation list (in-memory)', {
    tokenPrefix: token.substring(0, 10) + '...',
    expiresAt: new Date(expiryMs).toISOString(),
  });
}

/**
 * Returns true if the token has been explicitly revoked.
 * Fails open (returns false) on error — maintaining uptime over strict security.
 * Document this trade-off for any security audit.
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const expiry = inMemoryBlacklist.get(token);
  if (expiry === undefined) return false;
  if (expiry < Date.now()) {
    // Already expired — clean up and treat as not blacklisted
    inMemoryBlacklist.delete(token);
    return false;
  }
  return true;
}

/** Returns diagnostic stats for the /health endpoint. */
export async function getStats(): Promise<{
  totalBlacklisted: number;
  backend: string;
}> {
  pruneExpired();
  return {
    totalBlacklisted: inMemoryBlacklist.size,
    backend: 'in-memory (Redis not connected)',
  };
}

export async function connect(): Promise<void> {
  logger.info('Token blacklist service initialized (in-memory fallback)');
}

export async function disconnect(): Promise<void> {
  logger.info('Token blacklist service disconnected');
}
