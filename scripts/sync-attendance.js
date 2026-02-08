// scripts/sync-attendance.js
// Auto-sync attendance logs from fingerprint device to database
// Usage: node scripts/sync-attendance.js
// Production: Run as cron job every 5 minutes

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fingerprintService = require('../src/services/fingerprint.service');
const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 100; // Process logs in batches
const LOG_PREFIX = '[SYNC-ATTENDANCE]';

/**
 * Map device log to attendance record
 */
function mapLogToAttendance(log, employeeMapping) {
    const employee = employeeMapping.get(String(log.deviceUserId));

    if (!employee) {
        console.warn(`${LOG_PREFIX} ⚠️  User ID ${log.deviceUserId} not found in mapping`);
        return null;
    }

    // Determine attendance type based on time or sequence
    const hour = new Date(log.recordTime).getHours();
    const tipeAbsensi = hour < 12 ? 'MASUK' : 'PULANG';

    return {
        user_id: String(log.deviceUserId),
        nip: employee.nip,
        nama: employee.nama,
        jabatan: employee.jabatan,
        tanggal: new Date(log.recordTime).toISOString().split('T')[0],
        waktu_absensi: log.recordTime,
        tipe_absensi: tipeAbsensi,
        device_id: process.env.FINGERPRINT_DEVICE_ID || 'FingerBaja',
        verification_method: log.checkType === 1 ? 'SIDIK_JARI' : 'LAINNYA'
    };
}

/**
 * Process and save attendance log
 */
async function processAttendanceLog(attendanceData) {
    try {
        // Check if record already exists for this date
        const existing = await prisma.attendance.findFirst({
            where: {
                nip: attendanceData.nip,
                tanggal: new Date(attendanceData.tanggal)
            }
        });

        if (existing) {
            // Update jam_masuk or jam_keluar
            if (attendanceData.tipe_absensi === 'MASUK' && !existing.jam_masuk) {
                await prisma.attendance.update({
                    where: { id: existing.id },
                    data: {
                        jam_masuk: new Date(attendanceData.waktu_absensi),
                        updated_at: new Date()
                    }
                });
                console.log(`${LOG_PREFIX} ✅ Updated jam_masuk: ${attendanceData.nama}`);
            } else if (attendanceData.tipe_absensi === 'PULANG' && !existing.jam_keluar) {
                await prisma.attendance.update({
                    where: { id: existing.id },
                    data: {
                        jam_keluar: new Date(attendanceData.waktu_absensi),
                        updated_at: new Date()
                    }
                });
                console.log(`${LOG_PREFIX} ✅ Updated jam_keluar: ${attendanceData.nama}`);
            } else {
                console.log(`${LOG_PREFIX} ⏭️  Skip: ${attendanceData.nama} - already recorded`);
            }
        } else {
            // Create new attendance record
            const insertData = {
                user_id: attendanceData.user_id,
                nip: attendanceData.nip,
                nama: attendanceData.nama,
                jabatan: attendanceData.jabatan,
                tanggal: new Date(attendanceData.tanggal),
                device_id: attendanceData.device_id,
                verification_method: attendanceData.verification_method,
                status: 'HADIR',
                is_deleted: false
            };

            // Set jam_masuk or jam_keluar based on type
            if (attendanceData.tipe_absensi === 'MASUK') {
                insertData.jam_masuk = new Date(attendanceData.waktu_absensi);
            } else {
                insertData.jam_keluar = new Date(attendanceData.waktu_absensi);
            }

            await prisma.attendance.create({ data: insertData });
            console.log(`${LOG_PREFIX} ✅ Created attendance: ${attendanceData.nama} (${attendanceData.tipe_absensi})`);
        }

        return true;
    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error saving attendance:`, error.message);
        return false;
    }
}

/**
 * Main sync function
 */
async function syncAttendance() {
    const startTime = Date.now();
    console.log(`${LOG_PREFIX} 🚀 Starting attendance sync...`);
    console.log(`${LOG_PREFIX} Device: ${process.env.FINGERPRINT_IP}:${process.env.FINGERPRINT_PORT}`);

    try {
        // 1. Fetch device mapping (NIP <-> User ID)
        console.log(`${LOG_PREFIX} 📥 Fetching employee device mapping...`);
        const mappings = await prisma.$queryRaw`
      SELECT 
        m.device_user_id,
        m.nip,
        e.nama,
        e.jabatan
      FROM employee_device_mapping m
      JOIN employees e ON m.nip = e.nip
      WHERE e.is_active = 1
    `;

        const employeeMapping = new Map();
        mappings.forEach(m => {
            employeeMapping.set(String(m.device_user_id), {
                nip: m.nip,
                nama: m.nama,
                jabatan: m.jabatan
            });
        });

        console.log(`${LOG_PREFIX} ✅ Loaded ${employeeMapping.size} employee mappings`);

        // 2. Connect to device and fetch logs
        console.log(`${LOG_PREFIX} 🔌 Connecting to fingerprint device...`);
        const logs = await fingerprintService.getAttendanceLogs();
        console.log(`${LOG_PREFIX} ✅ Fetched ${logs.length} attendance logs from device`);

        if (logs.length === 0) {
            console.log(`${LOG_PREFIX} ℹ️  No new attendance logs to process`);
            return { success: true, processed: 0, failed: 0 };
        }

        // 3. Process logs in batches
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < logs.length; i += BATCH_SIZE) {
            const batch = logs.slice(i, i + BATCH_SIZE);
            console.log(`${LOG_PREFIX} 🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(logs.length / BATCH_SIZE)}...`);

            for (const log of batch) {
                const attendanceData = mapLogToAttendance(log, employeeMapping);

                if (!attendanceData) {
                    failCount++;
                    continue;
                }

                const success = await processAttendanceLog(attendanceData);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }
        }

        // 4. Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`${LOG_PREFIX} ✅ Sync completed in ${duration}s`);
        console.log(`${LOG_PREFIX} 📊 Summary:`);
        console.log(`${LOG_PREFIX}    Total logs: ${logs.length}`);
        console.log(`${LOG_PREFIX}    Success: ${successCount}`);
        console.log(`${LOG_PREFIX}    Failed: ${failCount}`);

        return {
            success: true,
            processed: successCount,
            failed: failCount,
            duration
        };

    } catch (error) {
        console.error(`${LOG_PREFIX} 💥 Fatal error during sync:`, error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    syncAttendance()
        .then(result => {
            console.log(`${LOG_PREFIX} 🎉 Done!`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`${LOG_PREFIX} 💥 Sync failed:`, error);
            process.exit(1);
        });
}

module.exports = syncAttendance;
