// src/routes/adms.routes.js
const express = require('express');
const ADMSController = require('../controllers/adms.controller');

const router = express.Router();

/**
 * @swagger
 * /adms/push:
 *   post:
 *     summary: Push data absensi dari mesin fingerprint
 *     description: |
 *       Endpoint internal untuk mesin fingerprint mengirim data absensi.
 *       Membutuhkan API key yang valid dan validasi perangkat.
 *       Tidak ditujukan untuk panggilan API langsung.
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
 *                 description: Identifikasi sistem cloud
 *               device_id:
 *                 type: string
 *                 description: Identifikasi perangkat fingerprint
 *               user_id:
 *                 type: string
 *                 description: Identifikasi pengguna
 *               nama:
 *                 type: string
 *                 description: Nama lengkap
 *               nip:
 *                 type: string
 *                 description: Nomor induk pegawai
 *               jabatan:
 *                 type: string
 *                 enum: [DOSEN, KARYAWAN]
 *                 description: Jabatan
 *               tanggal_absensi:
 *                 type: string
 *                 format: date
 *                 description: Tanggal absensi (YYYY-MM-DD)
 *               waktu_absensi:
 *                 type: string
 *                 format: time
 *                 description: Waktu absensi (HH:mm:ss)
 *               tipe_absensi:
 *                 type: string
 *                 enum: [MASUK, PULANG]
 *                 description: Tipe absensi
 *               verifikasi:
 *                 type: string
 *                 default: SIDIK_JARI
 *                 description: Metode verifikasi
 *               api_key:
 *                 type: string
 *                 description: API key perangkat untuk autentikasi
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp request untuk validasi
 *               signature:
 *                 type: string
 *                 description: Signature HMAC untuk validasi request
 *     responses:
 *       200:
 *         description: Data absensi berhasil diproses
 *       400:
 *         description: Data request tidak valid
 *       403:
 *         description: Autentikasi gagal
 *       409:
 *         description: Rekaman absensi duplikat
 */
router.post('/push', ADMSController.pushAttendance);

/**
 * @swagger
 * /adms/health:
 *   get:
 *     summary: Pemeriksaan kesehatan layanan ADMS
 *     description: Endpoint pemeriksaan kesehatan untuk mesin fingerprint
 *     tags: [Device]
 *     responses:
 *       200:
 *         description: Layanan sehat
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
