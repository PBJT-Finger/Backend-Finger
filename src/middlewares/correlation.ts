import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

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
 * Request correlation ID middleware
 */
export function requestCorrelation(req: Request, res: Response, next: NextFunction): void {
  const correlationIdHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const correlationId =
    (Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader) || uuidv4();

  req.correlationId = correlationId;

  res.setHeader('X-Request-ID', correlationId);
  res.setHeader('X-Correlation-ID', correlationId);

  if (req.app.locals['logger']) {
    req.logger = req.app.locals['logger'].child({ correlationId });
  }

  next();
}

/**
 * Enhanced request correlation with more metadata
 */
export function enhancedCorrelation(req: Request, res: Response, next: NextFunction): void {
  const correlationIdHeader = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const correlationId =
    (Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader) || uuidv4();

  req.correlationId = correlationId;

  const correlationMeta: Record<string, any> = {
    correlationId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  };

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
 * Correlation ID validator
 */
export function validateCorrelationId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
