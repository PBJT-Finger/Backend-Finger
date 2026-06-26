// src/routes/metrics.routes.ts
// Mengatur rute API untuk mengekspor metrik aplikasi dalam format Prometheus.
// Rute ini digunakan oleh server monitoring (seperti Prometheus) untuk memantau performa sistem.

import { Router, Request, Response } from 'express';
import { register } from '../utils/metrics'; // Registri metrik Prometheus dari utility metrics

const router = Router();

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Ekspor metrics Prometheus
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Data metrics Prometheus
 */
// Endpoint untuk menarik data metrik sistem (GET /api/metrics)
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    // Set format Content-Type sesuai spesifikasi Prometheus (misal text/plain)
    res.set('Content-Type', register.contentType);
    // Ambil data akumulasi metrik
    const metrics = await register.metrics();
    res.send(metrics); // Kirim hasil metrik ke client/Prometheus scraping tool
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : String(error));
  }
});

export default router;
