/**
 * src/utils/logger.ts — Centralized structured logger (Winston)
 *
 * Every log entry is emitted as JSON to allow ingestion by log aggregators
 * (ELK, Grafana Loki, CloudWatch). Console transport is added in non-production
 * environments with colorized, human-readable formatting.
 *
 * Structured fields contract (mandatory on every entry):
 *   timestamp, level, service, message
 * Optional but recommended:
 *   correlationId, userId, traceId, context
 *
 * Security: Never log passwords, tokens, PII, or raw request bodies here.
 * Use the sanitization utilities before passing context to logger.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogContext {
  correlationId?: string | undefined;
  userId?: number | undefined;
  traceId?: string | undefined;
  [key: string]: unknown;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

const LOG_COLORS: Record<keyof typeof LOG_LEVELS, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(LOG_COLORS);

// Ensure log directory exists before transports are created
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: jsonFormat,
  }),
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: jsonFormat,
  }),
];

if (env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
        })
      ),
    })
  );
}

// ─── Logger Instance ─────────────────────────────────────────────────────────

const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: LOG_LEVELS,
  format: jsonFormat,
  transports,
  defaultMeta: { service: 'backend-finger' },
});

// ─── Typed Facade ────────────────────────────────────────────────────────────

/**
 * Application logger facade factory.
 * Wraps winston with typed `LogContext` and a dedicated `audit()` method.
 */
const createFacade = (winstonInst: winston.Logger) => ({
  error: (message: string, context?: LogContext) => winstonInst.error(message, context),
  warn: (message: string, context?: LogContext) => winstonInst.warn(message, context),
  info: (message: string, context?: LogContext) => winstonInst.info(message, context),
  http: (message: string, context?: LogContext) => winstonInst.http(message, context),
  debug: (message: string, context?: LogContext) => winstonInst.debug(message, context),

  /**
   * Logs a security-relevant event to the audit trail.
   */
  audit: (event: string, userId: number, metadata: Record<string, unknown> = {}) => {
    winstonInst.info(`AUDIT: ${event}`, {
      event,
      userId,
      ...metadata,
      auditTimestamp: new Date().toISOString(),
    });
  },

  /**
   * Creates a child logger with bound contextual data.
   */
  child: (context: LogContext) => createFacade(winstonInst.child(context) as winston.Logger),
});

const logger = createFacade(winstonLogger);

export default logger;
