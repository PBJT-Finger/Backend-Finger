import { Router } from 'express';
import { PersonalController } from '../controllers/personal.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Middleware: Harus login, dan role harus DOSEN atau KARYAWAN
// (Admin dan pimpinan tidak diarahkan ke sini, tapi bisa disesuaikan jika perlu)
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
