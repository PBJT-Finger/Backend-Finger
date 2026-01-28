// src/infrastructure/container/registerRepositories.js
// Register repository implementations in the DI container

const container = require('./container');

// Repository implementations
const PrismaEmployeeRepository = require('../repositories/prisma/PrismaEmployeeRepository');
const PrismaAttendanceRepository = require('../repositories/prisma/PrismaAttendanceRepository');

/**
 * Register all repositories in the container
 */
function registerRepositories() {
    // Employee Repository
    container.register(
        'EmployeeRepository',
        () => new PrismaEmployeeRepository(),
        true // Singleton
    );

    // Attendance Repository
    container.register(
        'AttendanceRepository',
        () => new PrismaAttendanceRepository(),
        true // Singleton
    );

    console.log('✓ Repositories registered in DI container');
}

module.exports = registerRepositories;
