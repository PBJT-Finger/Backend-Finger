import { Router, Request, Response } from 'express';
import { register } from '../utils/metrics';

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
router.get('/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : String(error));
  }
});

export default router;
