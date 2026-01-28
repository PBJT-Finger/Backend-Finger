// src/routes/attendance.routes.clean.js
// CLEAN ARCHITECTURE VERSION - Routes using clean controller

const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendance.controller.clean');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/attendance/summary:
 *   get:
 *     summary: Get attendance summary (Clean Architecture)
 *     tags: [Attendance]
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: nip
 *         schema:
 *           type: string
 *       - in: query
 *         name: jabatan
 *         schema:
 *           type: string
 *           enum: [DOSEN, KARYAWAN]
 *     responses:
 *       200:
 *         description: Attendance summary retrieved successfully
 */
router.get('/summary', authenticate, AttendanceController.getAttendanceSummary);

/**
 * @swagger
 * /api/attendance/dosen:
 *   get:
 *     summary: Get lecturer attendance
 *     tags: [Attendance]
 */
router.get('/dosen', authenticate, AttendanceController.getLecturerAttendance);

/**
 * @swagger
 * /api/attendance/karyawan:
 *   get:
 *     summary: Get employee attendance
 *     tags: [Attendance]
 */
router.get('/karyawan', authenticate, AttendanceController.getEmployeeAttendance);

/**
 * @swagger
 * /api/attendance/employee/:nip:
 *   get:
 *     summary: Get detailed employee attendance
 *     tags: [Attendance]
 */
router.get('/employee/:nip', authenticate, AttendanceController.getEmployeeDetails);

/**
 * @swagger
 * /api/attendance/record:
 *   post:
 *     summary: Record attendance from fingerprint device
 *     tags: [Attendance]
 */
router.post('/record', AttendanceController.recordAttendance);

/**
 * @swagger
 * /api/attendance/:id:
 *   delete:
 *     summary: Delete attendance record
 *     tags: [Attendance]
 */
router.delete('/:id', authenticate, AttendanceController.deleteAttendance);

// Legacy compatibility routes
router.get('/', authenticate, AttendanceController.getAttendance);

module.exports = router;
