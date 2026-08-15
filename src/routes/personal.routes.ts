import { Router } from 'express';
import { PersonalController } from '../controllers/personal.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Middleware: Harus login. Otorisasi ketat hanya untuk DOSEN dan KARYAWAN
// Admin dan Pimpinan tidak diizinkan masuk ke rute personal ini
const restrictToPegawai = requireRole('DOSEN', 'KARYAWAN');

/**
 * @swagger
 * /api/personal/me:
 *   get:
 *     summary: Mendapatkan riwayat absensi pribadi
 *     tags: [Personal]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', authenticateToken, restrictToPegawai, PersonalController.getMyAttendance);

/**
 * @swagger
 * /api/personal/me/summary:
 *   get:
 *     summary: Mendapatkan ringkasan kehadiran pribadi bulan ini
 *     tags: [Personal]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me/summary', authenticateToken, restrictToPegawai, PersonalController.getMySummary);

export default router;
