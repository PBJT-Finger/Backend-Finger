import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import logger from '../utils/logger';

const router = Router();

// Liveness check
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Cek status liveness server
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server berjalan normal
 */
router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check
/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Cek kesiapan server (termasuk koneksi database)
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server siap melayani request
 *       503:
 *         description: Server belum siap
 */
router.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
// Trigger CI/CD
