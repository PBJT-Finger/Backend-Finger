// src/app.ts - Aplikasi Express utama untuk Sistem Rekap Absensi Kampus
import express, { Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Memuat variabel lingkungan dari file .env
dotenv.config();

// Mengimpor router untuk masing-masing modul endpoint API
import authRoutes from './routes/auth.routes';
import attendanceRoutes from './routes/attendance.routes';
import dashboardRoutes from './routes/dashboard.routes';
import exportRoutes from './routes/export.routes';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';
import metricsRoutes from './routes/metrics.routes';
import employeeRoutes from './routes/employee.routes';

// Mengimpor middleware kustom untuk logging request, correlation ID, dan Prometheus metrics
import { requestLogger } from './middlewares/auth.middleware';
import { requestCorrelation } from './middlewares/correlation';
import { metricsMiddleware } from './middlewares/metrics.middleware';

// Mengimpor spesifikasi dokumentasi OpenAPI (Swagger) dan Scalar UI
import { specs, swaggerUi, swaggerOptions } from './config/swagger';
import { generateScalarHTML } from './config/scalar.config';
import { translateTags, translateDescription, getTranslation } from './config/i18n.translations';

// Mengimpor modul logger (Pino) dan Prisma client untuk interaksi database
import logger from './utils/logger';
import prisma from './config/prisma';

// Mengimpor batasan rate limiting untuk mengamankan API dari serangan brute force/spam
import { RATE_LIMITS } from './constants/rateLimits';

// Menginisialisasi aplikasi Express
const app = express();

// Menyediakan logger ke level lokal aplikasi Express agar bisa diakses oleh middleware lain
app.locals['logger'] = logger;

// Mengatur template engine EJS (Embedded JavaScript) untuk merender halaman view (jika ada)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/finger-api/docs/views'));

// Memberitahu Express untuk mempercayai proxy (penting jika dideploy di balik Nginx/Load Balancer untuk cookie aman)
app.set('trust proxy', 1);

// Membuat instance rate limiter berdasarkan batas (limit) masing-masing endpoint
const generalLimiter = rateLimit(RATE_LIMITS.GENERAL_API);
const authLimiter = rateLimit(RATE_LIMITS.AUTH_LOGIN);
const exportLimiter = rateLimit(RATE_LIMITS.EXPORT_API);
const summaryLimiter = rateLimit(RATE_LIMITS.SUMMARY_API);
const dashboardLimiter = rateLimit(RATE_LIMITS.DASHBOARD_API);

// Middleware keamanan Helmet (dinonaktifkan sementara atas permintaan pengguna untuk mempermudah integrasi frontend lokal)
/*
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
        connectSrc: ["'self'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.tailwindcss.com', 'api.scalar.com', 'https://api.scalar.com'],
        fontSrc: [
          "'self'",
          'fonts.googleapis.com',
          'fonts.gstatic.com',
          'cdnjs.cloudflare.com',
          'cdn.jsdelivr.net',
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
      maxAge: 31536000, // 1 tahun
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
*/

// Mendefinisikan asal request (Origins) yang diizinkan mengakses backend lewat CORS
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

// Menerapkan konfigurasi CORS
app.use(
  cors({
    origin: function (origin, callback) {
      // Mengizinkan request tanpa origin (seperti aplikasi mobile, Postman, curl)
      if (!origin) return callback(null, true);

      // Pada mode development, izinkan semua origin localhost dinamis
      if (isDevelopment && origin.startsWith('http://localhost')) {
        return callback(null, true);
      }

      // Memeriksa apakah origin ada dalam daftar putih (whitelist)
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn('Request diblokir oleh CORS', { origin, allowedOrigins });
        callback(new Error('Akses diblokir oleh aturan CORS'));
      }
    },
    credentials: true, // Mengizinkan pengiriman cookie / header otorisasi
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 600, // Cache preflight request selama 10 menit
  })
);

// Menerapkan middleware Correlation ID sedini mungkin untuk penelusuran logs (Distributed Tracing)
app.use(requestCorrelation);

// Menerapkan middleware pengumpul metrik Prometheus untuk memantau performa request
app.use(metricsMiddleware);

// Konfigurasi Kompresi Gzip - Sengaja dinonaktifkan khusus untuk endpoint Server-Sent Events (SSE)
// karena kompresi bawaan zlib akan menahan (buffer) data SSE sehingga event live feed tidak akan terkirim
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['accept'] === 'text/event-stream') return false; // Jangan kompres jika SSE
      return compression.filter(req, res);
    },
  })
);

// Konfigurasi parsing body request dengan pembatasan ukuran payload maksimal 10MB
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mencatat log untuk setiap incoming HTTP request
app.use(requestLogger);

// Menerapkan rate limiter pada endpoint API tertentu
app.use('/api/auth', authLimiter);
app.use('/api/export', exportLimiter);
app.use('/api/dashboard', dashboardLimiter);
app.use('/api/attendance/summary', summaryLimiter);
app.use('/api', generalLimiter); // Pembatasan umum untuk endpoint API lainnya

// Menyajikan file statis (HTML, CSS, gambar) dari folder public
app.use(express.static(path.join(__dirname, '../public')));

// Menyambungkan rute pemeriksaan kesehatan (health check) sistem
app.use(healthRoutes);

// Menyambungkan rute metrik Prometheus (untuk dimonitor oleh Prometheus scraper)
app.use(metricsRoutes);

// Endpoint kesiapan sistem (Readiness check - menguji apakah database MySQL aktif dan siap menerima query)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Menjalankan query minimal untuk memastikan koneksi database menyala
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'mysql-connected',
    });
  } catch (error: any) {
    logger.error('Pemeriksaan kesiapan (Readiness check) gagal:', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'not ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env['NODE_ENV'] === 'development' ? error.message : undefined,
    });
  }
});

// Mengalihkan rute beranda utama '/' ke halaman dokumentasi API minimalis
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/api-docs.html'));
});

// ==================== DOKUMENTASI API SCALAR (UI MODERN) ====================
// Menampilkan dokumentasi API interaktif dengan Scalar UI bertema gradien teal-purple
app.get('/finger-api/docs', (req: Request, res: Response) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// URL alternatif untuk dokumentasi Scalar
app.get('/api-docs', (req: Request, res: Response) => {
  const html = generateScalarHTML(specs);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ==================== DOKUMENTASI API SWAGGER UI (STANDARD) ====================
app.use('/finger-api/swagger', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// Endpoint OpenAPI JSON spec - Mendukung lokalisasi/terjemahan bahasa (Indonesian / English)
app.get('/finger-api/docs-json', (req: Request, res: Response) => {
  const lang = (req.query['lang'] as string) || 'en';

  // Menyalin spesifikasi OpenAPI agar tidak memodifikasi objek asli secara global
  const localizedSpecs = JSON.parse(JSON.stringify(specs));

  // Jika parameter bahasa adalah bahasa Indonesia ('id'), terjemahkan deskripsi Swagger
  if (lang === 'id') {
    localizedSpecs.info.title = getTranslation(lang, 'title');
    localizedSpecs.info.description = translateDescription(localizedSpecs.info.description, lang);

    if (localizedSpecs.tags) {
      localizedSpecs.tags = translateTags(localizedSpecs.tags, lang);
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(localizedSpecs);
});

// Mengimpor rute pengoperasian mesin fingerprint
import deviceRoutes from './routes/device.routes';

// Menyambungkan semua rute utama API aplikasi backend
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/device', deviceRoutes);

// Mengimpor middleware penanganan error tersentralisasi
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.middleware';

// Penanganan rute tidak ditemukan (404 Handler) - Harus diletakkan setelah semua rute terdaftar
app.use(notFoundHandler);

// Penanganan error global aplikasi (500 Handler) - Harus diletakkan di baris paling akhir
app.use(errorHandler);

export default app;
