// jest.config.js - Jest Testing Configuration
module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Coverage collection
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/server.js',
        '!src/**/*.test.js',
        '!src/**/*.spec.js'
    ],

    // Coverage thresholds (optional - adjust as needed)
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },

    // Test match patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ],

    // Verbose output
    verbose: true,

    // Timeout
    testTimeout: 10000
};
