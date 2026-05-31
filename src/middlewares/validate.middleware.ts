import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import logger from '../utils/logger';

interface ExtractedValidationError {
  field: string;
  message: string;
  value: unknown;
}

/**
 * Middleware to handle validation errors from express-validator
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors: ExtractedValidationError[] = errors
      .array()
      .map((err: ValidationError) => {
        // express-validator newer versions use 'path', older may use 'param'
        // We safely check both by type casting
        const rawErr = err as Record<string, unknown>;
        const field = String(rawErr['path'] || rawErr['param'] || '');
        return {
          field,
          message: err.msg,
          value: rawErr['value'],
        };
      });

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      errors: extractedErrors,
    });

    return res.status(400).json({
      success: false,
      message: 'Input validation failed',
      errors: extractedErrors,
    });
  }

  next();
};

/**
 * Sanitize request inputs
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      const val = req.query[key];
      if (typeof val === 'string') {
        req.query[key] = val.replace(/\0/g, '').trim();
      }
    });
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      const val = req.body[key];
      if (typeof val === 'string') {
        req.body[key] = val.replace(/\0/g, '').trim();
      }
    });
  }

  next();
};
