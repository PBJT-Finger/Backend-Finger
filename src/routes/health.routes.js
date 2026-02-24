/**
 * Health Check Routes
 * Provides comprehensive system health monitoring
 */

const express = require('express');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const router = express.Router();

// Liveness check — container is alive (no DB required)
// Used by Docker HEALTHCHECK and load balancers
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check — verifies DB connectivity before accepting traffic
router.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
