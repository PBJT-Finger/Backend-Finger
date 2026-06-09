// src/app.ts - Aplikasi Express utama untuk Sistem Rekap Absensi Kampus
import express, { Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import attendanceRoutes from './routes/attendance.routes';
import dashboardRoutes from './routes/dashboard.routes';
import exportRoutes from './routes/export.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';
import metricsRoutes from './routes/metrics.routes';
import employeeRoutes from './routes/employee.routes';

// Import middleware
import { requestLogger } from './middlewares/auth.middleware';
import { requestCorrelation } from './middlewares/correlation';
import { metricsMiddleware } from './middlewares/metrics.middleware';

// Import Swagger & Scalar config
import { specs } from './config/swagger';
import { generateScalarHTML } from './config/scalar.config';
import { translateTags, translateDescription, getTranslation } from './config/i18n.translations';

// Import logger & prisma
import logger from './utils/logger';
import prisma from './config/prisma';

// Import rate limit configurations
import { RATE_LIMITS } from './constants/rateLimits';

// Initialize Express app
const app = express();

// Make logger available to correlation middleware / templates
app.locals['logger'] = logger;

// EJS Template Engine Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/finger-api/docs/views'));

// Trust proxy for secure cookies
app.set('trust proxy', 1);

// Create rate limiters for different endpoint types
const generalLimiter = rateLimit(RATE_LIMITS.GENERAL_API);
const authLimiter = rateLimit(RATE_LIMITS.AUTH_LOGIN);
const exportLimiter = rateLimit(RATE_LIMITS.EXPORT_API);
const summaryLimiter = rateLimit(RATE_LIMITS.SUMMARY_API);
const dashboardLimiter = rateLimit(RATE_LIMITS.DASHBOARD_API);

// Middleware keamanan dengan Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdn.jsdelivr.net',
          'cdnjs.cloudflare.com',
          'fonts.googleapis.com',
          'cdn.tailwindcss.com',
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdn.jsdelivr.net',
          'cdnjs.cloudflare.com',
          'unpkg.com',
          'cdn.tailwindcss.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.tailwindcss.com'],
        fontSrc: [
          "'self'",
          'fonts.googleapis.com',
          'fonts.gstatic.com',
          'cdnjs.cloudflare.com',
          'data:',
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Konfigurasi CORS dengan multi-origin support
const allowedOrigins = process.env['CORS_ORIGINS']
  ? process.env['CORS_ORIGINS'].split(',').map((origin) => origin.trim())
  : [
      'http://localhost:5555',
      'http://localhost:3000',
      'http://localhost:3333',
      'https://finger.pbjt.web.id',
      'https://finger-be.pbjt.web.id',
    ];

const isDevelopment = process.env['NODE_ENV'] !== 'production';

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins
      if (isDevelopment && origin.startsWith('http://localhost')) {
        return callback(null, true);
      }

      // In production or for non-localhost, check whitelist
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin, allowedOrigins });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 600, // 10 minutes preflight cache
  })
);

// Request Correlation - Apply EARLY for distributed tracing
app.use(requestCorrelation);

// Prometheus Metrics - Track all requests
app.use(metricsMiddleware);

// Compression — explicitly disabled for SSE (text/event-stream) routes.
// zlib buffers small writes indefinitely, which silently swallows SSE events
// and leaves the browser stuck in a "Connecting..." state forever.
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['accept'] === 'text/event-stream') return false;
      return compression.filter(req, res);
    },
  })
);

// Body parsing dengan batas ukuran
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Apply rate limiting to routes
app.use('/api/auth', authLimiter);
app.use('/api/export', exportLimiter);
app.use('/api/dashboard', dashboardLimiter);
app.use('/api/attendance/summary', summaryLimiter);
app.use('/api', generalLimiter); // Catch-all for other API endpoints

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check routes (no auth required, for monitoring systems)
app.use(healthRoutes);

// Metrics endpoint (no auth required, for Prometheus scraper)
app.use(metricsRoutes);

// Readiness check (database connectivity via Prisma)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Verify active DB connection with a minimal query
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'mysql-connected',
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env['NODE_ENV'] === 'development' ? error.message : undefined,
    });
  }
});

// Custom minimalist docs landing page (redirect / to docs)
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});

// ==================== SCALAR API DOCUMENTATION (MODERN UI) ====================
// Modern, beautiful API documentation with dark teal-purple gradient
app.get('/finger-api/docs', (req: Request, res: Response) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Alternative URL for Scalar docs
app.get('/api-docs', (req: Request, res: Response) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// OpenAPI JSON spec endpoint - with language support
app.get('/finger-api/docs-json', (req: Request, res: Response) => {
  const lang = (req.query['lang'] as string) || 'en';

  // Clone specs for modification
  const localizedSpecs = JSON.parse(JSON.stringify(specs));

  // Apply translations if language is Indonesian
  if (lang === 'id') {
    // Translate main info
    localizedSpecs.info.title = getTranslation(lang, 'title');
    localizedSpecs.info.description = translateDescription(localizedSpecs.info.description, lang);

    // Translate tags
    if (localizedSpecs.tags) {
      localizedSpecs.tags = translateTags(localizedSpecs.tags, lang);
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(localizedSpecs);
});

import deviceRoutes from './routes/device.routes';

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/device', deviceRoutes);

// Import centralized error handlers
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.middleware';

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;
