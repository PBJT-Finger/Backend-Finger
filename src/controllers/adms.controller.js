// src/controllers/adms.controller.js
// Controller for ADMS fingerprint device endpoints (Prisma)

const { prisma } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

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
      const employee = await prisma.employees.findFirst({
        where: {
          nip: nip,
          is_active: true
        },
        select: {
          jabatan: true,
          nama: true
        }
      });

      if (!employee) {
        return errorResponse(res, `Employee with NIP ${nip} not found or inactive`, 404);
      }

      const jabatan = employee.jabatan; // Auto-detected jabatan (DOSEN or KARYAWAN)
      const employeeName = employee.nama || nama; // Use employee name from database

      // Parse date for querying
      const attendanceDate = new Date(tanggal_absensi);

      // Check for existing record on this date for this user
      const existingRecord = await prisma.attendance.findFirst({
        where: {
          nip: nip,
          tanggal: attendanceDate,
          is_deleted: false
        }
      });

      let recordId;

      if (existingRecord) {
        // Update based on tipe_absensi
        if (tipe_absensi === 'MASUK' && !existingRecord.jam_masuk) {
          // Update jam_masuk if not set
          const updated = await prisma.attendance.update({
            where: { id: existingRecord.id },
            data: { jam_masuk: waktu_absensi }
          });
          recordId = updated.id;
        } else if (tipe_absensi === 'PULANG' && !existingRecord.jam_keluar) {
          // Update jam_keluar if not set
          const updated = await prisma.attendance.update({
            where: { id: existingRecord.id },
            data: { jam_keluar: waktu_absensi }
          });
          recordId = updated.id;
        } else {
          // Record already exists, return success without update
          return successResponse(
            res,
            { id: existingRecord.id },
            'Attendance record already exists',
            200
          );
        }
      } else {
        // Create new attendance record
        const insertData = {
          user_id: user_id,
          nip: nip,
          nama: employeeName, // Use validated name from employees table
          jabatan: jabatan, // Auto-detected jabatan
          tanggal: attendanceDate,
          device_id: device_id,
          cloud_id: cloud_id || null, // Cloud system identifier
          verification_method: verifikasi || 'SIDIK_JARI', // Verification method
          status: 'HADIR',
          is_deleted: false
        };

        // Set jam_masuk or jam_keluar based on tipe
        if (tipe_absensi === 'MASUK') {
          insertData.jam_masuk = waktu_absensi;
          insertData.jam_keluar = null;
        } else if (tipe_absensi === 'PULANG') {
          insertData.jam_masuk = null;
          insertData.jam_keluar = waktu_absensi;
        }

        const result = await prisma.attendance.create({
          data: insertData
        });

        recordId = result.id;
      }

      logger.info('Attendance pushed from ADMS device', {
        nip,
        device_id,
        tipe_absensi,
        tanggal: tanggal_absensi
      });

      return successResponse(
        res,
        {
          id: recordId,
          nip,
          tanggal: tanggal_absensi,
          tipe: tipe_absensi
        },
        'Attendance recorded successfully',
        201
      );
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
      return successResponse(
        res,
        {
          service: 'ADMS Fingerprint Integration',
          timestamp: new Date().toISOString(),
          status: 'operational'
        },
        'ADMS service is healthy'
      );
    } catch (error) {
      logger.error('ADMS health check error', { error: error.message });
      return errorResponse(res, 'Service unavailable', 503);
    }
  }
}

module.exports = ADMSController;
