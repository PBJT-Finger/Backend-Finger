/**
 * Prometheus Metrics Configuration
 * Tracks HTTP requests, errors, database queries, and business metrics
 */

const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Enable default metrics (CPU, memory, event loop, GC)
promClient.collectDefaultMetrics({
    register,
    prefix: 'finger_api_'
});

// ==================== CUSTOM METRICS ====================

// 1. HTTP Request Duration Histogram
const httpRequestDuration = new promClient.Histogram({
    name: 'finger_api_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

// 2. HTTP Request Counter
const httpRequestTotal = new promClient.Counter({
    name: 'finger_api_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

// 3. Active Requests Gauge
const activeRequests = new promClient.Gauge({
    name: 'finger_api_http_requests_active',
    help: 'Number of currently active HTTP requests'
});
register.registerMetric(activeRequests);

// 4. Error Counter
const errorCounter = new promClient.Counter({
    name: 'finger_api_errors_total',
    help: 'Total number of application errors',
    labelNames: ['type', 'route']
});
register.registerMetric(errorCounter);

// 5. Redis Operations Counter
const redisOps = new promClient.Counter({
    name: 'finger_api_redis_operations_total',
    help: 'Total Redis operations',
    labelNames: ['operation', 'status']
});
register.registerMetric(redisOps);

// 6. Database Query Duration
const dbQueryDuration = new promClient.Histogram({
    name: 'finger_api_db_query_duration_seconds',
    help: 'Database query execution time',
    labelNames: ['query_type'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2]
});
register.registerMetric(dbQueryDuration);

// 7. Business Metrics - Attendance Records
const attendanceRecords = new promClient.Counter({
    name: 'finger_api_attendance_records_total',
    help: 'Total attendance records created',
    labelNames: ['type'] // MASUK, PULANG
});
register.registerMetric(attendanceRecords);

// 8. Authentication Metrics
const authAttempts = new promClient.Counter({
    name: 'finger_api_auth_attempts_total',
    help: 'Total authentication attempts',
    labelNames: ['status'] // success, failure
});
register.registerMetric(authAttempts);

// 9. Token Blacklist Size
const tokenBlacklistSize = new promClient.Gauge({
    name: 'finger_api_token_blacklist_size',
    help: 'Current number of blacklisted tokens in Redis'
});
register.registerMetric(tokenBlacklistSize);

// 10. Rate Limit Violations
const rateLimitViolations = new promClient.Counter({
    name: 'finger_api_rate_limit_violations_total',
    help: 'Total rate limit violations',
    labelNames: ['type'] // ip, user
});
register.registerMetric(rateLimitViolations);

module.exports = {
    register,
    httpRequestDuration,
    httpRequestTotal,
    activeRequests,
    errorCounter,
    redisOps,
    dbQueryDuration,
    attendanceRecords,
    authAttempts,
    tokenBlacklistSize,
    rateLimitViolations
};
