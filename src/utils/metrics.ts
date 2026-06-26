// src/utils/metrics.ts
// Mengatur pengumpulan metrik Prometheus (menggunakan prom-client) untuk memantau
// kinerja backend (CPU, memory, durasi query, hitungan error, total request HTTP, dll).

import * as promClient from 'prom-client';

// Membuat Registry penampung metrik Prometheus
export const register = new promClient.Registry();

// Mengumpulkan metrik bawaan sistem (default metrics Node.js seperti penggunaan CPU, event loop lag, memory)
promClient.collectDefaultMetrics({
  register,
  prefix: 'finger_api_', // Prefiks label metrik
});

// ==================== CUSTOM METRICS (METRIK KUSTOM) ====================

// 1. Histogram Durasi Request HTTP
export const httpRequestDuration = new promClient.Histogram({
  name: 'finger_api_http_request_duration_seconds',
  help: 'Durasi pemrosesan HTTP request dalam satuan detik',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // Pembagian ember rentang detik (buckets)
});
register.registerMetric(httpRequestDuration);

// 2. Counter Total Request HTTP
export const httpRequestTotal = new promClient.Counter({
  name: 'finger_api_http_requests_total',
  help: 'Jumlah total request HTTP yang masuk ke backend',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestTotal);

// 3. Gauge Jumlah Request HTTP Aktif
export const activeRequests = new promClient.Gauge({
  name: 'finger_api_http_requests_active',
  help: 'Jumlah request HTTP yang saat ini sedang aktif diproses (in-flight)',
});
register.registerMetric(activeRequests);

// 4. Counter Eror Aplikasi
export const errorCounter = new promClient.Counter({
  name: 'finger_api_errors_total',
  help: 'Jumlah total error yang terjadi pada aplikasi',
  labelNames: ['type', 'route'],
});
register.registerMetric(errorCounter);

// 5. Counter Operasi Redis/Cache
export const redisOps = new promClient.Counter({
  name: 'finger_api_redis_operations_total',
  help: 'Jumlah total operasi baca/tulis Redis',
  labelNames: ['operation', 'status'],
});
register.registerMetric(redisOps);

// 6. Histogram Durasi Query Database
export const dbQueryDuration = new promClient.Histogram({
  name: 'finger_api_db_query_duration_seconds',
  help: 'Durasi eksekusi query ke database MySQL',
  labelNames: ['query_type'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
});
register.registerMetric(dbQueryDuration);

// 7. Metrik Bisnis - Jumlah Log Kehadiran Pegawai
export const attendanceRecords = new promClient.Counter({
  name: 'finger_api_attendance_records_total',
  help: 'Jumlah total data absensi yang berhasil dibuat/disimpan',
  labelNames: ['type'],
});
register.registerMetric(attendanceRecords);

// 8. Metrik Autentikasi (Percobaan Login)
export const authAttempts = new promClient.Counter({
  name: 'finger_api_auth_attempts_total',
  help: 'Jumlah total upaya autentikasi login admin',
  labelNames: ['status'],
});
register.registerMetric(authAttempts);

// 9. Gauge Jumlah Token Ter-Blacklist
export const tokenBlacklistSize = new promClient.Gauge({
  name: 'finger_api_token_blacklist_size',
  help: 'Jumlah token JWT aktif yang sedang di-blacklist di Redis/Cache',
});
register.registerMetric(tokenBlacklistSize);

// 10. Counter Pelanggaran Rate Limit
export const rateLimitViolations = new promClient.Counter({
  name: 'finger_api_rate_limit_violations_total',
  help: 'Jumlah total pelanggaran rate limit oleh pengguna/IP',
  labelNames: ['type'],
});
register.registerMetric(rateLimitViolations);
