// src/routes/health.routes.ts
// Mengatur rute cek kesehatan (healthcheck) server.
// Menyediakan liveness check (untuk memeriksa apakah server hidup)
// dan readiness check (untuk memeriksa kesiapan server beserta konektivitas database).

import { Router, Request, Response } from 'express';
import prisma from '../config/prisma'; // Prisma client untuk melakukan ping query ke database
import logger from '../utils/logger'; // Logger internal aplikasi

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
// Endpoint untuk cek keaktifan server (GET /api/health)
router.get('/health', (_req: Request, res: Response): void => {
  // Hanya mengembalikan status 'ok' jika aplikasi berjalan, tanpa melakukan query database
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
// Endpoint untuk cek kesiapan database & server (GET /api/health/ready)
router.get('/health/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Mengecek koneksi database dengan mengirimkan query sederhana 'SELECT 1'
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Catat log jika terjadi kegagalan koneksi database
    logger.error('Pemeriksaan kesiapan server gagal (koneksi database bermasalah)', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Mengembalikan status 503 Service Unavailable
    res.status(503).json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
