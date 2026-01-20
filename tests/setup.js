// tests/setup.js - Jest Setup Configuration
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'finger_attendance_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-12345';
process.env.API_KEY_SECRET = 'test-api-key-secret';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests (optional)
global.console = {
    ...console,
    log: jest.fn(), // Mock console.log
    debug: jest.fn(), // Mock console.debug
    info: jest.fn(), // Mock console.info
    // Keep error and warn for debugging
    error: console.error,
    warn: console.warn
};
