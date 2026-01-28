// src/infrastructure/database/prisma.client.js
// Centralized Prisma Client configuration

const { PrismaClient } = require('@prisma/client');

// Create singleton Prisma client instance
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'pretty',
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

module.exports = { prisma };
