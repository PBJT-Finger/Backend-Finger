// src/infrastructure/container/registerUseCases.js
// Register use cases in the DI container

const container = require('./container');

// Use Cases
const GetAttendanceSummaryUseCase = require('../../application/use-cases/attendance/GetAttendanceSummary.usecase');
const RecordAttendanceUseCase = require('../../application/use-cases/attendance/RecordAttendance.usecase');
const GetEmployeeAttendanceUseCase = require('../../application/use-cases/attendance/GetEmployeeAttendance.usecase');
const DeleteAttendanceUseCase = require('../../application/use-cases/attendance/DeleteAttendance.usecase');

/**
 * Register all use cases in the container
 */
function registerUseCases() {
    // Get Attendance Summary Use Case
    container.register(
        'GetAttendanceSummaryUseCase',
        (c) => new GetAttendanceSummaryUseCase(
            c.resolve('EmployeeRepository'),
            c.resolve('AttendanceRepository')
        ),
        true // Singleton
    );

    // Record Attendance Use Case
    container.register(
        'RecordAttendanceUseCase',
        (c) => new RecordAttendanceUseCase(
            c.resolve('AttendanceRepository'),
            c.resolve('EmployeeRepository')
        ),
        true // Singleton
    );

    // Get Employee Attendance Use Case
    container.register(
        'GetEmployeeAttendanceUseCase',
        (c) => new GetEmployeeAttendanceUseCase(
            c.resolve('EmployeeRepository'),
            c.resolve('AttendanceRepository')
        ),
        true // Singleton
    );

    // Delete Attendance Use Case
    container.register(
        'DeleteAttendanceUseCase',
        (c) => new DeleteAttendanceUseCase(
            c.resolve('AttendanceRepository')
        ),
        true // Singleton
    );

    console.log('✓ Use Cases registered in DI container');
}

module.exports = registerUseCases;
