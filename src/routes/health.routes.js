/**
 * Health Check Routes
 * Provides comprehensive system health monitoring
 */

const express = require('express');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Pemeriksaan kesehatan komprehensif
 *     description: Mengembalikan status komponen detail dan metrik sistem
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Sistem sehat
 *       503:
 *         description: Sistem tidak sehat atau terdegradasi
 */
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version,
    checks: {}
  };

  // Check Database Connection (Prisma)
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
      type: 'MySQL (Prisma)'
    };
  } catch (error) {
    health.checks.database = {
      status: 'down',
      error: error.message
    };
    health.status = 'unhealthy';
  }

  // Check Redis Connection
  try {
    const redisStart = Date.now();
    const { redis } = require('../utils/tokenBlacklist');
    await redis.ping();

    // Get Redis info
    const info = await redis.info('memory');
    const memMatch = info.match(/used_memory_human:([^\r\n]+)/);

    health.checks.redis = {
      status: 'up',
      responseTime: Date.now() - redisStart,
      memory: memMatch ? memMatch[1].trim() : 'unknown'
    };
  } catch (error) {
    health.checks.redis = {
      status: 'degraded',
      error: error.message,
      note: 'System continues with graceful degradation'
    };
    // Don't mark as unhealthy - graceful degradation is working
  }

  // Memory Usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: 'ok',
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
  };

  // CPU Usage
  const cpuUsage = process.cpuUsage();
  health.checks.cpu = {
    status: 'ok',
    user: `${Math.round(cpuUsage.user / 1000)}ms`,
    system: `${Math.round(cpuUsage.system / 1000)}ms`
  };

  // Event Loop Lag (simple check)
  const lagStart = Date.now();
  setImmediate(() => {
    const lag = Date.now() - lagStart;
    health.checks.eventLoop = {
      status: lag < 100 ? 'ok' : 'degraded',
      lag: `${lag}ms`
    };
  });

  // Overall response time
  health.responseTime = Date.now() - startTime;

  // Determine HTTP status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json(health);
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Probe liveness
 *     description: Kubernetes liveness probe - memeriksa apakah aplikasi berjalan
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Aplikasi masih hidup
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Probe readiness
 *     description: Kubernetes readiness probe - memeriksa apakah aplikasi siap menerima traffic
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Aplikasi siap
 *       503:
 *         description: Aplikasi tidak siap
 */
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
