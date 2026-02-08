const logger = require('./logger');

// DISABLED Redis for development - mock implementation
const redis = {
  status: 'disabled',
  on: () => {},
  connect: async () => {},
  quit: async () => {},
  setex: async () => {},
  exists: async () => 0,
  keys: async () => [],
  info: async () => 'memory:0'
};

/**
 * Add JWT token to blacklist (Mocked)
 */
async function addToBlacklist(token, expirySeconds) {
  logger.info('MOCK: Token added to blacklist (Redis disabled)');
  return true;
}

/**
 * Check if JWT token is blacklisted (Mocked)
 */
async function isBlacklisted(token) {
  // Fail open: always return false when Redis is disabled
  return false;
}

/**
 * Get blacklist statistics (Mocked)
 */
async function getStats() {
  return {
    totalBlacklisted: 0,
    redisStatus: 'disabled',
    memoryUsage: '0'
  };
}

/**
 * Connect to Redis (Mocked)
 */
async function connect() {
  logger.info('Token blacklist service (Mocked) initialized');
}

/**
 * Gracefully close Redis connection (Mocked)
 */
async function disconnect() {
  logger.info('Token blacklist service (Mocked) disconnected');
}

module.exports = {
  addToBlacklist,
  isBlacklisted,
  getStats,
  connect,
  disconnect,
  redis
};
