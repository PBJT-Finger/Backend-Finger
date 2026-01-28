// src/infrastructure/container/bootstrap.js
// Bootstrap the DI container with all dependencies

const container = require('./container');
const registerRepositories = require('./registerRepositories');
const registerUseCases = require('./registerUseCases');

/**
 * Initialize the DI container with all dependencies
 */
function bootstrap() {
    console.log('🚀 Bootstrapping DI Container...');

    // Register repositories first (lowest level dependencies)
    registerRepositories();

    // Register use cases (depend on repositories)
    registerUseCases();

    console.log('✅ DI Container initialized successfully\n');

    return container;
}

module.exports = bootstrap;
