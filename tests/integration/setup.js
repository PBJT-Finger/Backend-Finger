// Integration test setup and utilities
const { sequelize } = require('../../src/models');
const { connect: connectRedis, disconnect: disconnectRedis } = require('../../src/utils/tokenBlacklist');

// Setup before all integration tests
beforeAll(async () => {
    console.log('🔧 Setting up integration test environment...');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');
}, 30000); // 30 second timeout for setup

// Cleanup after all tests
afterAll(async () => {
    console.log('🧹 Cleaning up integration test environment...');

    // Disconnect Redis
    await disconnectRedis();
    console.log('✅ Redis disconnected');

    // Close database connection
    await sequelize.close();
    console.log('✅ Database closed');
}, 30000);

// Helper function to generate unique test username
function generateTestUsername(prefix = 'test_user') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

module.exports = {
    generateTestUsername
};
