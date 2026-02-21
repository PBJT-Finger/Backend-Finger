/**
 * Health Check Routes
 * Provides comprehensive system health monitoring
 */

const express = require('express');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const router = express.Router();


router.get('/health/ready', async (req, res) => {
  try {
    // Check critical dependencies (Prisma)
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
