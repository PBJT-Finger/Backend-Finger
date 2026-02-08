// src/app.js - Aplikasi Express utama untuk Sistem Rekap Absensi Kampus
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const exportRoutes = require('./routes/export.routes');
const admsRoutes = require('./routes/adms.routes');
const adminRoutes = require('./routes/admin.routes'); // Admin management
const deviceRoutes = require('./routes/device.routes'); // Device management
const healthRoutes = require('./routes/health.routes'); // Advanced monitoring
const metricsRoutes = require('./routes/metrics.routes'); // Prometheus

// Import middleware
const { requestLogger } = require('./middlewares/auth.middleware');
const { requestCorrelation } = require('./middlewares/correlation'); // Phase 3: Correlation
const { metricsMiddleware } = require('./middlewares/metrics.middleware'); // Prometheus metrics

// Import Swagger
const { specs } = require('./config/swagger');

// Import database
// Removed testSequelizeConnection - not used

// Import logger
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Make logger available to correlation middleware
app.locals.logger = logger;

// EJS Template Engine Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/finger-api/docs/views'));

// Trust proxy for secure cookies
app.set('trust proxy', 1);

// Import rate limit configurations
const rateLimits = require('./constants/rateLimits');

// Create rate limiters for different endpoint types
const generalLimiter = rateLimit(rateLimits.GENERAL_API);
const authLimiter = rateLimit(rateLimits.AUTH_LOGIN);
const exportLimiter = rateLimit(rateLimits.EXPORT_API);
const summaryLimiter = rateLimit(rateLimits.SUMMARY_API);
const dashboardLimiter = rateLimit(rateLimits.DASHBOARD_API);
const admsLimiter = rateLimit(rateLimits.ADMS_PUSH);

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
          'fonts.googleapis.com'
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdn.jsdelivr.net',
          'cdnjs.cloudflare.com',
          'unpkg.com'
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
        fontSrc: [
          "'self'",
          'fonts.googleapis.com',
          'fonts.gstatic.com',
          'cdnjs.cloudflare.com',
          'data:'
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"] // Allow iframes for API reference embedding
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: []
    }
  })
);

// Konfigurasi CORS dengan multi-origin support
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3333'];

const isDevelopment = process.env.NODE_ENV !== 'production';

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
    maxAge: 600 // 10 minutes preflight cache
  })
);

// Phase 3: Request Correlation - Apply EARLY for distributed tracing
app.use(requestCorrelation);

// Prometheus Metrics - Track all requests
app.use(metricsMiddleware);

// Kompresi
app.use(compression());

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
app.use('/adms', admsLimiter);
app.use('/api', generalLimiter); // Catch-all for other API endpoints

// Serve static files
app.use(express.static('public'));

// Health check routes (no auth required, for monitoring systems)
app.use(healthRoutes);

// Metrics endpoint (no auth required, for Prometheus scraper)
app.use(metricsRoutes);

// Readiness check (database connectivity)
app.get('/ready', async (req, res) => {
  try {
    // DISABLED: Sequelize check (we're using raw MySQL)
    // const { sequelize } = require('./models');
    // await sequelize.authenticate();

    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'mysql-ready'
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Serve custom API docs landing page
app.use(express.static('public'));

// Custom minimalist docs landing page (redirect / to docs)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/api-docs.html');
});

// Helper function to render documentation pages with EJS
const renderDocsPage = (page, title, options = {}) => {
  return (req, res) => {
    res.render('layouts/main', {
      title,
      currentPage: page,
      showSidebar: options.showSidebar !== false,
      prismTheme: options.prismTheme !== false,
      prismScripts: options.prismScripts !== false,
      body: '' // Will be filled by layout
    });
  };
};

// ==================== SCALAR API DOCUMENTATION (MODERN UI) ====================
// Modern, beautiful API documentation with dark teal-purple gradient
const { generateScalarHTML } = require('./config/scalar.config');

// Main API Documentation - Scalar
app.get('/finger-api/docs', (req, res) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Alternative URL for Scalar docs
app.get('/api-docs', (req, res) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// OpenAPI JSON spec endpoint - with language support
const {
  translateTags,
  translateDescription,
  getTranslation
} = require('./config/i18n.translations');

app.get('/finger-api/docs-json', (req, res) => {
  const lang = req.query.lang || 'en';

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

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes); // Admin management
app.use('/api/device', deviceRoutes); // Device management

// Routes ADMS (terpisah dari API utama)
app.use('/adms', admsRoutes);

// Import centralized error handlers
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler.middleware');

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
