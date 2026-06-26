// src/middlewares/metrics.middleware.ts
// Middleware pengumpul metrik kinerja Prometheus untuk memantau durasi request,
// jumlah total request, serta request aktif (in-flight) secara real-time.

import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal, activeRequests } from '../utils/metrics'; // Klien metrik Prometheus

/**
 * Middleware Prometheus metrics.
 * Memantau dan mencatat durasi, jumlah hits, serta status request HTTP.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Naikkan jumlah hitungan request aktif (in-flight requests)
  activeRequests.inc();

  // Menentukan jalur rute (path), gunakan pola path Express jika ada (misal /users/:id)
  let route = req.route ? req.route.path : req.path;

  // Bersihkan parameter dinamis agar tidak memecah metrik menjadi baris-baris tak terbatas di Prometheus
  route = route.replace(/:[^\s/]+/g, ':id');

  // Ketika proses respons selesai dikirim ke client (finish event)
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Hitung durasi request dalam satuan detik
    const statusCode = res.statusCode.toString();

    // Rekam durasi request ke histogram metrik Prometheus
    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: statusCode,
      },
      duration
    );

    // Naikkan counter total hit request HTTP dengan label terkait
    httpRequestTotal.inc({
      method: req.method,
      route: route,
      status_code: statusCode,
    });

    // Turunkan jumlah hitungan request aktif setelah selesai diproses
    activeRequests.dec();
  });

  next();
}
