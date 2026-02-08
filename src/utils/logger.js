// src/utils/logger.js - Sistem logging terpusat dengan Winston
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Definisikan level log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Buat direktori logs jika belum ada
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Definisikan format log
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }),
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format
  })
];

// Console transport untuk melihat detail error saat development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Bagian ini yang saya tambahkan untuk mengeluarkan pesan error asli
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports
});

// Add audit method for audit trail logging
logger.audit = function (event, userId, metadata = {}) {
  logger.info(`AUDIT: ${event}`, {
    event,
    userId,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
