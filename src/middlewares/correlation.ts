// src/middlewares/correlation.ts
// Middleware untuk pelacakan (Correlation ID) pada HTTP request.
// Menyisipkan UUID unik ke dalam header respons agar memudahkan pelacakan log transaksi (trace logs).

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid'; // Generator string UUID v4

// Mendeklarasikan modifikasi properti interface Request bawaan Express secara global
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      correlationMeta?: any;
      logger?: any;
    }
  }
}

/**
 * Middleware dasar penyematan Request Correlation ID.
 */
export function requestCorrelation(req: Request, res: Response, next: NextFunction): void {
  // Ambil ID pelacakan dari header request jika dikirim oleh client, atau buat baru jika tidak ada
  const correlationIdHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const correlationId =
    (Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader) || uuidv4();

  req.correlationId = correlationId;

  // Pasang ID pelacakan ke header respons HTTP
  res.setHeader('X-Request-ID', correlationId);
  res.setHeader('X-Correlation-ID', correlationId);

  // Jika terdapat pino logger di instansi aplikasi Express, buat instansi logger turunan (child logger)
  // dengan menyertakan context correlationId secara otomatis ke setiap log
  if (req.app.locals['logger']) {
    req.logger = req.app.locals['logger'].child({ correlationId });
  }

  next();
}

/**
 * Middleware Correlation ID yang diperkaya dengan metadata tambahan (IP, User Agent, dll).
 */
export function enhancedCorrelation(req: Request, res: Response, next: NextFunction): void {
  const correlationIdHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const correlationId =
    (Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader) || uuidv4();

  req.correlationId = correlationId;

  // Susun metadata konteks request saat ini
  const correlationMeta: Record<string, any> = {
    correlationId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Sertakan detail user jika request sudah melewati middleware autentikasi token
  if (req.user) {
    correlationMeta['userId'] = req.user.id;
    correlationMeta['username'] = req.user.username;
  }

  req.correlationMeta = correlationMeta;

  res.setHeader('X-Request-ID', correlationId);
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

/**
 * Validasi untuk memeriksa apakah format string Correlation ID berupa UUID v4 yang valid.
 */
export function validateCorrelationId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
