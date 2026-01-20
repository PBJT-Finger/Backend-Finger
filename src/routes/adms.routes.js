// src/routes/adms.routes.js
const express = require('express');
const ADMSController = require('../controllers/adms.controller');

const router = express.Router();

/**
 * @swagger
 * /adms/push:
 *   post:
 *     summary: Push attendance data from fingerprint machines
 *     description: |
 *       Internal endpoint for fingerprint machines to push attendance data.
 *       Requires valid API key and device validation.
 *       Not intended for direct API calls.
 *     tags: [Device]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cloud_id
 *               - device_id
 *               - user_id
 *               - nama
 *               - nip
 *               - jabatan
 *               - tanggal_absensi
 *               - waktu_absensi
 *               - tipe_absensi
 *               - api_key
 *             properties:
 *               cloud_id:
 *                 type: string
 *                 description: Cloud system identifier
 *               device_id:
 *                 type: string
 *                 description: Fingerprint device identifier
 *               user_id:
 *                 type: string
 *                 description: User identifier
 *               nama:
 *                 type: string
 *                 description: Full name
 *               nip:
 *                 type: string
 *                 description: Employee ID number
 *               jabatan:
 *                 type: string
 *                 enum: [DOSEN, KARYAWAN]
 *                 description: Position
 *               tanggal_absensi:
 *                 type: string
 *                 format: date
 *                 description: Attendance date (YYYY-MM-DD)
 *               waktu_absensi:
 *                 type: string
 *                 format: time
 *                 description: Attendance time (HH:mm:ss)
 *               tipe_absensi:
 *                 type: string
 *                 enum: [MASUK, PULANG]
 *                 description: Attendance type
 *               verifikasi:
 *                 type: string
 *                 default: SIDIK_JARI
 *                 description: Verification method
 *               api_key:
 *                 type: string
 *                 description: Device API key for authentication
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Request timestamp for validation
 *               signature:
 *                 type: string
 *                 description: HMAC signature for request validation
 *     responses:
 *       200:
 *         description: Attendance data processed successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Authentication failed
 *       409:
 *         description: Duplicate attendance record
 */
router.post('/push', ADMSController.pushAttendance);

/**
 * @swagger
 * /adms/health:
 *   get:
 *     summary: ADMS service health check
 *     description: Health check endpoint for fingerprint machines
 *     tags: [Device]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 */
router.get('/health', ADMSController.healthCheck);

module.exports = router;