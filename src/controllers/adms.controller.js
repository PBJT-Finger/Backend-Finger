// src/controllers/adms.controller.js
// Controller for ADMS fingerprint device endpoints

const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const db = require('../lib/db');

class ADMSController {
    /**
     * Push attendance data from fingerprint machines
     * POST /adms/push
     */
    static async pushAttendance(req, res) {
        try {
            const {
                cloud_id,
                device_id,
                user_id,
                nama,
                nip,
                tanggal_absensi,
                waktu_absensi,
                tipe_absensi,
                verifikasi = 'SIDIK_JARI',
                api_key
            } = req.body;

            // Validate required fields (jabatan is no longer required - will be auto-detected)
            if (!user_id || !nama || !nip || !tanggal_absensi || !waktu_absensi || !tipe_absensi) {
                return errorResponse(res, 'Missing required fields', 400);
            }

            // AUTO-LOOKUP: Get jabatan from employees table based on NIP
            const [employees] = await db.query(
                'SELECT jabatan, nama as employee_name FROM employees WHERE nip = ? AND is_active = 1',
                [nip]
            );

            if (!employees || employees.length === 0) {
                return errorResponse(res, `Employee with NIP ${nip} not found or inactive`, 404);
            }

            const jabatan = employees[0].jabatan; // Auto-detected jabatan (DOSEN or KARYAWAN)

            // Use employee name from database if provided name doesn't match
            const employeeName = employees[0].employee_name || nama;

            // Check for existing record on this date for this user
            const [existingRecords] = await db.query(
                'SELECT * FROM attendance WHERE nip = ? AND tanggal = ? AND is_deleted = 0',
                [nip, tanggal_absensi]
            );

            let recordId;

            if (existingRecords.length > 0) {
                const existing = existingRecords[0];

                // Update based on tipe_absensi
                if (tipe_absensi === 'MASUK' && !existing.jam_masuk) {
                    // Update jam_masuk if not set
                    await db.query(
                        'UPDATE attendance SET jam_masuk = ? WHERE id = ?',
                        [waktu_absensi, existing.id]
                    );
                    recordId = existing.id;
                } else if (tipe_absensi === 'PULANG' && !existing.jam_keluar) {
                    // Update jam_keluar if not set
                    await db.query(
                        'UPDATE attendance SET jam_keluar = ? WHERE id = ?',
                        [waktu_absensi, existing.id]
                    );
                    recordId = existing.id;
                } else {
                    // Record already exists, return success without update
                    return successResponse(res, { id: existing.id }, 'Attendance record already exists', 200);
                }
            } else {
                // Create new attendance record
                const insertData = {
                    user_id: user_id,
                    nip: nip,
                    nama: employeeName,  // Use validated name from employees table
                    jabatan: jabatan,     // Auto-detected jabatan
                    tanggal: tanggal_absensi,
                    device_id: device_id,
                    cloud_id: cloud_id || null,  // NEW: Cloud system identifier
                    verification_method: verifikasi || 'SIDIK_JARI',  // NEW: Verification method
                    status: 'HADIR',
                    is_deleted: 0
                };

                // Set jam_masuk or jam_keluar based on tipe
                if (tipe_absensi === 'MASUK') {
                    insertData.jam_masuk = waktu_absensi;
                } else if (tipe_absensi === 'PULANG') {
                    insertData.jam_keluar = waktu_absensi;
                }

                const [result] = await db.query(
                    `INSERT INTO attendance 
           (user_id, nip, nama, jabatan, tanggal, jam_masuk, jam_keluar, device_id, cloud_id, verification_method, status, is_deleted) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        insertData.user_id,
                        insertData.nip,
                        insertData.nama,
                        insertData.jabatan,
                        insertData.tanggal,
                        insertData.jam_masuk || null,
                        insertData.jam_keluar || null,
                        insertData.device_id,
                        insertData.cloud_id,
                        insertData.verification_method,
                        insertData.status,
                        insertData.is_deleted
                    ]
                );

                recordId = result.insertId;
            }

            logger.info('Attendance pushed from ADMS device', {
                nip,
                device_id,
                tipe_absensi,
                tanggal: tanggal_absensi
            });

            return successResponse(res, {
                id: recordId,
                nip,
                tanggal: tanggal_absensi,
                tipe: tipe_absensi
            }, 'Attendance recorded successfully', 201);

        } catch (error) {
            logger.error('ADMS push attendance error', {
                error: error.message,
                stack: error.stack
            });
            return errorResponse(res, 'Failed to record attendance', 500);
        }
    }

    /**
     * Health check for ADMS service
     * GET /adms/health
     */
    static async healthCheck(req, res) {
        try {
            return successResponse(res, {
                service: 'ADMS Fingerprint Integration',
                timestamp: new Date().toISOString(),
                status: 'operational'
            }, 'ADMS service is healthy');
        } catch (error) {
            logger.error('ADMS health check error', { error: error.message });
            return errorResponse(res, 'Service unavailable', 503);
        }
    }
}

module.exports = ADMSController;
