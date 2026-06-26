/**
 * src/utils/logger.ts — Layanan Logger Terpusat Berstruktur (Winston)
 *
 * Setiap entri log diterbitkan dalam format JSON agar mudah diintegrasikan dengan
 * pengumpul log (seperti Grafana Loki, ELK Stack, atau AWS CloudWatch).
 * Pada mode non-production, log konsol akan diperkaya dengan warna agar lebih mudah dibaca manusia.
 *
 * Kontrak struktur log (Wajib ada di setiap entri):
 *   timestamp, level, service, message
 *
 * Opsional (Direkomendasikan):
 *   correlationId, userId, traceId, context
 *
 * Keamanan: Jangan pernah mencatat password, token, atau data pribadi mentah ke log.
 * Gunakan utilitas sensor (logRedactor.ts) sebelum mengirim data ke log.
 */

import winston from 'winston'; // Library logger Winston
import path from 'path'; // Modul manipulasi path Node.js
import fs from 'fs'; // Modul sistem file Node.js
import { env } from '../config/env'; // Variabel lingkungan (.env) ter-validasi

// ─── Tipe Data ────────────────────────────────────────────────────────────────

export interface LogContext {
  correlationId?: string | undefined;
  userId?: number | undefined;
  traceId?: string | undefined;
  [key: string]: unknown;
}

// ─── Konfigurasi Setup ─────────────────────────────────────────────────────────

// Definisi level log prioritas
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

// Definisi warna log di konsol
const LOG_COLORS: Record<keyof typeof LOG_LEVELS, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(LOG_COLORS);

// Pastikan folder log sudah terbuat sebelum transport Winston diaktifkan
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Format output JSON standar untuk log file
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
  winston.format.errors({ stack: true }), // Sertakan stack trace jika ada objek error
  winston.format.json()
);

// Tumpukan transport (destinasi penulisan log)
const transports: winston.transport[] = [
  // 1. Tulis log tingkat 'error' saja ke file error.log
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: jsonFormat,
  }),
  // 2. Tulis semua log (info, warn, error) ke file combined.log
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: jsonFormat,
  }),
];

// Pada mode development, tambahkan output berwarna ke konsol
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

// ─── Instance Logger Winston ─────────────────────────────────────────────────

const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL,
  levels: LOG_LEVELS,
  format: jsonFormat,
  transports,
  defaultMeta: { service: 'backend-finger' }, // Identitas service aplikasi
});

// ─── Facade Pembungkus Bertipe (Facade Logger) ───────────────────────────────

/**
 * Membungkus instansi Winston agar memiliki pengetikan log kontekstual (LogContext)
 * serta menambahkan metode pembantu audit() untuk keperluan keamanan sistem.
 */
const createFacade = (winstonInst: winston.Logger) => ({
  error: (message: string, context?: LogContext) => winstonInst.error(message, context),
  warn: (message: string, context?: LogContext) => winstonInst.warn(message, context),
  info: (message: string, context?: LogContext) => winstonInst.info(message, context),
  http: (message: string, context?: LogContext) => winstonInst.http(message, context),
  debug: (message: string, context?: LogContext) => winstonInst.debug(message, context),

  /**
   * Mencatat log audit (keamanan/perubahan data penting) ke dalam sistem.
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
   * Membuat log turunan (child logger) dengan data context yang menempel terus-menerus.
   */
  child: (context: LogContext) => createFacade(winstonInst.child(context) as winston.Logger),
});

const logger = createFacade(winstonLogger);

export default logger;
