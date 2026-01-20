/**
 * Metrics Routes
 * Exposes Prometheus metrics endpoint
 */

const express = require('express');
const { register } = require('../utils/metrics');

const router = express.Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: Exposes application metrics in Prometheus format
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Metrics data in Prometheus exposition format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.send(metrics);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

module.exports = router;
