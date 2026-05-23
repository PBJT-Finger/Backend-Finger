import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal, activeRequests } from '../utils/metrics';

/**
 * Prometheus metrics middleware
 * Tracks request duration, count, and active requests
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Increment active requests
  activeRequests.inc();

  // Sanitize route path
  let route = req.route ? req.route.path : req.path;

  // Replace dynamic params with placeholder
  route = route.replace(/:[^\s/]+/g, ':id');

  // On response finish
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();

    // Record request duration
    httpRequestDuration.observe(
      {
        method: req.method,
        route: route,
        status_code: statusCode,
      },
      duration
    );

    // Increment request counter
    httpRequestTotal.inc({
      method: req.method,
      route: route,
      status_code: statusCode,
    });

    // Decrement active requests
    activeRequests.dec();
  });

  next();
}
