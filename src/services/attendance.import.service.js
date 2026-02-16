// src/services/attendance.import.service.js - Import Service for Manual Attendance Data
const XLSX = require('xlsx');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

class AttendanceImportService {
    /**
     * Parse Excel/CSV file buffer to array of objects
     * @param {Buffer} buffer - File buffer
     * @param {string} filename - Original filename
     * @returns {Array} Array of row objects
     */
    static parseImportFile(buffer, filename) {
        try {
            // Read workbook from buffer
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON with header row
            const data = XLSX.utils.sheet_to_json(worksheet, {
                raw: false, // Don't use raw values, convert to strings
                dateNF: 'yyyy-mm-dd', // Date format
                defval: null // Default value for empty cells
            });

            logger.info(`Parsed ${data.length} rows from ${filename}`);
            return data;
        } catch (error) {
            logger.error('File parsing error:', error);
            throw new Error(`Gagal membaca file: ${error.message}`);
        }
    }

    /**
     * Detect file format (Fingerspot export vs Template manual)
     * @param {Array} rows - Parsed rows from Excel
     * @returns {string} 'FINGERSPOT' | 'TEMPLATE' | 'UNKNOWN'
     */
    static detectFileFormat(rows) {
        if (!rows || rows.length === 0) {
            return 'UNKNOWN';
        }

        const firstRow = rows[0];
        const columns = Object.keys(firstRow);

        logger.info('Detecting file format', { columns });

        // Fingerspot format: has specific columns from device export
        // Support both short names ("Tanggal Ab") and full names ("Tanggal Absensi")
        const fingerspotColumns = ['Cloud ID', 'Tipe Absen', 'Waktu Abs', 'NIK', 'Tanggal Ab', 'Tipe Absensi', 'Waktu Absensi', 'Tanggal Absensi'];
        const hasFingerspotColumns = fingerspotColumns.some(col => columns.includes(col));

        if (hasFingerspotColumns) {
            logger.info('Detected Fingerspot format');
            return 'FINGERSPOT';
        }

        // Template format: has our standard columns
        const templateColumns = ['nip', 'tanggal', 'jam_masuk'];
        const hasTemplateColumns = templateColumns.every(col => columns.includes(col));

        if (hasTemplateColumns) {
            logger.info('Detected Template format');
            return 'TEMPLATE';
        }

        logger.warn('Unknown file format', { columns });
        return 'UNKNOWN';
    }

    /**
     * Parse Fingerspot row to standard format
     * @param {Object} row - Fingerspot row data
     * @param {number} index - Row index
     * @returns {Object} Parsed data
     */
    static parseFingerspotRow(row, index) {
        try {
            const nip = String(row['NIK'] || row['ID'] || '').trim();
            const nama = String(row['Nama'] || '').trim();
            // Support both formats: "Tanggal Ab" (short) and "Tanggal Absensi" (full)
            const tanggalStr = String(row['Tanggal Absensi'] || row['Tanggal Ab'] || '').trim();
            const waktuStr = String(row['Waktu Absensi'] || row['Waktu Abs'] || '').trim();
            const tipeAbsen = String(row['Tipe Absensi'] || row['Tipe Absen'] || '').trim();
            const verifikasi = String(row['Verifikasi'] || 'Sidik Jari').trim();

            if (!nip || !tanggalStr || !waktuStr) {
                return null; // Invalid row
            }

            // Parse date - handle various formats
            let tanggal;
            try {
                // Fingerspot typically outputs: 2025-05-31
                if (/^\d{4}-\d{2}-\d{2}/.test(tanggalStr)) {
                    tanggal = new Date(tanggalStr.split(' ')[0]);
                } else {
                    tanggal = new Date(tanggalStr);
                }
            } catch (e) {
                logger.warn(`Invalid date at row ${index + 2}:`, tanggalStr);
                return null;
            }

            // Parse time - Fingerspot outputs: 17:20 or 08:05
            let waktu = waktuStr.trim();
            if (waktu && !waktu.includes(':')) {
                // If no colon, invalid time
                return null;
            }
            // Add seconds if not present
            if (waktu.split(':').length === 2) {
                waktu += ':00';
            }

            // Determine if check-in or check-out
            const tipeNormalized = tipeAbsen.toLowerCase();
            const isCheckIn = tipeNormalized.includes('masuk') || tipeNormalized.includes('pulang') === false;

            return {
                nip,
                nama,
                tanggal,
                waktu,
                isCheckIn,
                verifikasi: verifikasi.toUpperCase().replace(' ', '_')
            };
        } catch (error) {
            logger.error(`Error parsing Fingerspot row ${index + 2}:`, error.message);
            return null;
        }
    }

    /**
     * Group Fingerspot data by NIP and date
     * Merge check-in and check-out into single record
     * @param {Array} parsedRows - Parsed Fingerspot rows
     * @returns {Array} Grouped attendance records
     */
    static groupFingerspotData(parsedRows) {
        const grouped = {};

        parsedRows.forEach(row => {
            if (!row) return; // Skip null rows

            const dateStr = row.tanggal.toISOString().split('T')[0];
            const key = `${row.nip}_${dateStr}`;

            if (!grouped[key]) {
                grouped[key] = {
                    nip: row.nip,
                    nama: row.nama,
                    tanggal: row.tanggal,
                    jam_masuk: null,
                    jam_keluar: null,
                    verification_method: row.verifikasi,
                    status: 'HADIR'
                };
            }

            // Update name if empty (use most recent)
            if (!grouped[key].nama && row.nama) {
                grouped[key].nama = row.nama;
            }

            // Helper to combine date + time into DateTime
            const combineDateTime = (date, timeStr) => {
                const [hours, minutes, seconds] = timeStr.split(':');
                const dateTime = new Date(date);
                dateTime.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);
                return dateTime;
            };

            // Set check-in or check-out time
            if (row.isCheckIn) {
                // Use earliest check-in time
                const checkInTime = combineDateTime(row.tanggal, row.waktu);
                if (!grouped[key].jam_masuk || checkInTime < grouped[key].jam_masuk) {
                    grouped[key].jam_masuk = checkInTime;
                }
            } else {
                // Use latest check-out time
                const checkOutTime = combineDateTime(row.tanggal, row.waktu);
                if (!grouped[key].jam_keluar || checkOutTime > grouped[key].jam_keluar) {
                    grouped[key].jam_keluar = checkOutTime;
                }
            }
        });

        return Object.values(grouped);
    }

    /**
     * Validate single row data
     * @param {Object} row - Row data
     * @param {number} index - Row index (for error reporting)
     * @returns {Object} { valid: boolean, errors: Array, data: Object }
     */
    static async validateRow(row, index) {
        const errors = [];
        const rowNum = index + 2; // +2 because: 1-indexed + header row

        // Required: NIP
        if (!row.nip || String(row.nip).trim() === '') {
            errors.push(`Baris ${rowNum}: NIP wajib diisi`);
            return { valid: false, errors, data: null };
        }

        const nip = String(row.nip).trim();

        // Check employee exists
        let employee;
        try {
            employee = await prisma.employees.findUnique({
                where: { nip }
            });
        } catch (error) {
            logger.error('Error looking up employee:', { nip, error: error.message });
            errors.push(`Baris ${rowNum}: Error database - ${error.message}`);
            return { valid: false, errors, data: null };
        }

        if (!employee) {
            errors.push(`Baris ${rowNum}: NIP "${nip}" tidak ditemukan di database`);
            return { valid: false, errors, data: null };
        }

        // Required: Tanggal
        if (!row.tanggal || String(row.tanggal).trim() === '') {
            errors.push(`Baris ${rowNum}: Tanggal wajib diisi`);
            return { valid: false, errors, data: null };
        }

        // Validate date format (YYYY-MM-DD or DD/MM/YYYY or other formats)
        let tanggal;
        try {
            const tanggalStr = String(row.tanggal).trim();

            // Try parsing different date formats
            if (/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
                // YYYY-MM-DD
                tanggal = new Date(tanggalStr);
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tanggalStr)) {
                // DD/MM/YYYY
                const parts = tanggalStr.split('/');
                tanggal = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                // Try default parsing
                tanggal = new Date(tanggalStr);
            }

            if (isNaN(tanggal.getTime())) {
                throw new Error('Invalid date');
            }
        } catch (error) {
            errors.push(`Baris ${rowNum}: Format tanggal tidak valid (gunakan YYYY-MM-DD)`);
            return { valid: false, errors, data: null };
        }

        // Required: Jam Masuk
        if (!row.jam_masuk || String(row.jam_masuk).trim() === '') {
            errors.push(`Baris ${rowNum}: Jam masuk wajib diisi`);
            return { valid: false, errors, data: null };
        }

        // Validate time format (HH:mm:ss or HH:mm)
        const jamMasukStr = String(row.jam_masuk).trim();
        if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(jamMasukStr)) {
            errors.push(`Baris ${rowNum}: Format jam masuk tidak valid (gunakan HH:mm:ss)`);
            return { valid: false, errors, data: null };
        }

        // Normalize time format to HH:mm:ss
        const jamMasuk = jamMasukStr.includes(':') && jamMasukStr.split(':').length === 2
            ? `${jamMasukStr}:00`
            : jamMasukStr;

        // Optional: Jam Keluar
        let jamKeluar = null;
        if (row.jam_keluar && String(row.jam_keluar).trim() !== '') {
            const jamKeluarStr = String(row.jam_keluar).trim();
            if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(jamKeluarStr)) {
                errors.push(`Baris ${rowNum}: Format jam keluar tidak valid (gunakan HH:mm:ss)`);
                return { valid: false, errors, data: null };
            }
            jamKeluar = jamKeluarStr.includes(':') && jamKeluarStr.split(':').length === 2
                ? `${jamKeluarStr}:00`
                : jamKeluarStr;
        }

        // Optional: Jabatan (validate if provided, otherwise use from employee)
        let jabatan = employee.jabatan; // Default from database
        if (row.jabatan && String(row.jabatan).trim() !== '') {
            const jabatanStr = String(row.jabatan).trim().toUpperCase();
            if (!['DOSEN', 'KARYAWAN'].includes(jabatanStr)) {
                errors.push(`Baris ${rowNum}: Jabatan harus DOSEN atau KARYAWAN`);
                return { valid: false, errors, data: null };
            }
            jabatan = jabatanStr;
        }

        // Optional: Nama (use from employee if not provided)
        const nama = row.nama && String(row.nama).trim() !== ''
            ? String(row.nama).trim()
            : employee.nama;

        // Optional: Status
        const status = row.status && String(row.status).trim() !== ''
            ? String(row.status).trim().toUpperCase()
            : 'HADIR';

        // Optional: Verification Method
        const verificationMethod = row.verification_method && String(row.verification_method).trim() !== ''
            ? String(row.verification_method).trim().toUpperCase()
            : 'MANUAL';

        // Return validated data
        return {
            valid: true,
            errors: [],
            data: {
                user_id: nip,
                nip,
                nama,
                jabatan,
                tanggal,
                jam_masuk: jamMasuk,
                jam_keluar: jamKeluar,
                device_id: 'MANUAL_IMPORT',
                cloud_id: null,
                verification_method: verificationMethod,
                status,
                is_deleted: false
            }
        };
    }

    /**
     * Check if attendance record already exists
     * @param {string} nip
     * @param {Date} tanggal
     * @param {string} jamMasuk
     * @returns {Promise<boolean>}
     */
    static async isDuplicate(nip, tanggal, jamMasuk) {
        try {
            const existing = await prisma.attendance.findFirst({
                where: {
                    nip,
                    tanggal,
                    jam_masuk: jamMasuk,
                    is_deleted: false
                }
            });

            return existing !== null;
        } catch (error) {
            logger.error('Error checking duplicate:', { nip, tanggal, jamMasuk, error: error.message });
            return false; // If error, assume not duplicate to allow insert attempt
        }
    }

    /**
     * Process Fingerspot import file
     * @param {Array} rows - Parsed rows
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    static async processFingerspotImport(rows, options = {}) {
        const { skipDuplicates = true } = options;

        try {
            logger.info(`Processing Fingerspot import with ${rows.length} rows`);

            // Parse all Fingerspot rows
            const parsedRows = rows.map((row, index) => this.parseFingerspotRow(row, index))
                .filter(row => row !== null);

            logger.info(`Parsed ${parsedRows.length} valid rows from Fingerspot format`);

            if (parsedRows.length === 0) {
                return {
                    success: false,
                    message: 'Tidak ada data valid untuk diimport',
                    total: rows.length,
                    imported: 0,
                    skipped: rows.length,
                    duplicates: 0,
                    errors: ['Tidak ada baris data yang valid']
                };
            }

            // Group by NIP and date (merge check-in/check-out)
            const grouped = this.groupFingerspotData(parsedRows);
            logger.info(`Grouped into ${grouped.length} attendance records`);

            const results = {
                total: grouped.length,
                imported: 0,
                skipped: 0,
                duplicates: 0,
                errors: [],
                warnings: []
            };

            const validRecords = [];
            const duplicateRecords = [];

            // Validate and check each grouped record
            for (let i = 0; i < grouped.length; i++) {
                const record = grouped[i];

                // Check employee exists
                let employee;
                try {
                    employee = await prisma.employees.findUnique({
                        where: { nip: record.nip }
                    });
                } catch (error) {
                    logger.error('Error looking up employee:', { nip: record.nip, error: error.message });
                    results.errors.push(`NIP ${record.nip}: Error database - ${error.message}`);
                    results.skipped++;
                    continue;
                }

                if (!employee) {
                    results.warnings.push(`NIP ${record.nip} tidak ditemukan di database - dilewati`);
                    results.skipped++;
                    continue;
                }

                // Auto-fill nama and jabatan from employee if missing
                if (!record.nama) {
                    record.nama = employee.nama;
                }
                record.jabatan = employee.jabatan;
                record.user_id = employee.nip;
                record.device_id = 'FINGERSPOT_IMPORT';
                record.cloud_id = null;
                record.is_deleted = false;

                // Check duplicate
                if (record.jam_masuk) {
                    const isDupe = await this.isDuplicate(record.nip, record.tanggal, record.jam_masuk);
                    if (isDupe) {
                        if (skipDuplicates) {
                            duplicateRecords.push({
                                nip: record.nip,
                                nama: record.nama,
                                tanggal: record.tanggal,
                                jam_masuk: record.jam_masuk
                            });
                            results.duplicates++;
                            results.skipped++;
                            continue;
                        }
                    }
                }

                validRecords.push(record);
            }

            // Batch insert valid records
            if (validRecords.length > 0) {
                try {
                    await prisma.$transaction(async (tx) => {
                        const batchSize = 100;
                        for (let i = 0; i < validRecords.length; i += batchSize) {
                            const batch = validRecords.slice(i, i + batchSize);
                            await tx.attendance.createMany({
                                data: batch
                            });
                        }
                    });

                    results.imported = validRecords.length;
                    logger.info(`Successfully imported ${validRecords.length} Fingerspot records`);
                } catch (error) {
                    logger.error('Database insert error:', error);
                    throw new Error(`Gagal menyimpan data ke database: ${error.message}`);
                }
            }

            // Generate report
            return {
                success: true,
                message: this.generateImportMessage(results),
                ...results,
                duplicateDetails: duplicateRecords.length > 0 ? duplicateRecords.slice(0, 10) : undefined,
                warnings: results.warnings.length > 0 ? results.warnings.slice(0, 10) : undefined
            };
        } catch (error) {
            logger.error('Fingerspot import processing error:', error);
            return {
                success: false,
                message: error.message,
                total: rows.length,
                imported: 0,
                skipped: rows.length,
                errors: [error.message]
            };
        }
    }

    /**
     * Process import file and save to database
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} filename - Original filename
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result report
     */
    static async processImport(fileBuffer, filename, options = {}) {
        const { skipDuplicates = true } = options;

        try {
            // Parse file
            const rows = this.parseImportFile(fileBuffer, filename);

            if (!rows || rows.length === 0) {
                return {
                    success: false,
                    message: 'File kosong atau tidak ada data untuk diimport',
                    total: 0,
                    imported: 0,
                    skipped: 0,
                    errors: []
                };
            }

            // Detect file format
            const format = this.detectFileFormat(rows);
            logger.info(`Detected format: ${format}`);

            // Route to appropriate processor
            if (format === 'FINGERSPOT') {
                return await this.processFingerspotImport(rows, options);
            } else if (format === 'TEMPLATE') {
                return await this.processTemplateImport(rows, options);
            } else {
                return {
                    success: false,
                    message: 'Format file tidak dikenali. Gunakan template import atau file export dari Fingerspot.',
                    total: rows.length,
                    imported: 0,
                    skipped: rows.length,
                    errors: ['Format file tidak valid']
                };
            }
        } catch (error) {
            logger.error('Import processing error:', error);
            return {
                success: false,
                message: error.message,
                total: 0,
                imported: 0,
                skipped: 0,
                errors: [error.message]
            };
        }
    }

    /**
     * Process template format import (original logic)
     * @param {Array} rows - Parsed rows
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    static async processTemplateImport(rows, options = {}) {
        const { skipDuplicates = true } = options;

        try {
            const results = {
                total: rows.length,
                imported: 0,
                skipped: 0,
                duplicates: 0,
                errors: []
            };

            const validRecords = [];
            const duplicateRecords = [];

            // Validate all rows first
            for (let i = 0; i < rows.length; i++) {
                const validation = await this.validateRow(rows[i], i);

                if (!validation.valid) {
                    logger.warn(`Row ${i + 2} validation failed:`, validation.errors);
                    results.errors.push(...validation.errors);
                    results.skipped++;
                    continue;
                }

                // Check for duplicates
                const isDuplicate = await this.isDuplicate(
                    validation.data.nip,
                    validation.data.tanggal,
                    validation.data.jam_masuk
                );

                if (isDuplicate) {
                    if (skipDuplicates) {
                        duplicateRecords.push({
                            row: i + 2,
                            nip: validation.data.nip,
                            tanggal: validation.data.tanggal,
                            jam_masuk: validation.data.jam_masuk
                        });
                        results.duplicates++;
                        results.skipped++;
                        continue;
                    } else {
                        // Update existing record (not implemented in this version)
                        results.errors.push(`Baris ${i + 2}: Data duplikat ditemukan (update belum diimplementasi)`);
                        results.skipped++;
                        continue;
                    }
                }

                validRecords.push(validation.data);
            }

            // Batch insert valid records using transaction
            if (validRecords.length > 0) {
                try {
                    await prisma.$transaction(async (tx) => {
                        // Insert in batches of 100
                        const batchSize = 100;
                        for (let i = 0; i < validRecords.length; i += batchSize) {
                            const batch = validRecords.slice(i, i + batchSize);
                            await tx.attendance.createMany({
                                data: batch
                            });
                        }
                    });

                    results.imported = validRecords.length;
                    logger.info(`Successfully imported ${validRecords.length} attendance records from ${filename}`);
                } catch (error) {
                    logger.error('Database insert error:', error);
                    throw new Error(`Gagal menyimpan data ke database: ${error.message}`);
                }
            }

            // Generate report
            return {
                success: true,
                message: this.generateImportMessage(results),
                ...results,
                duplicateDetails: duplicateRecords.length > 0 ? duplicateRecords : undefined
            };
        } catch (error) {
            logger.error('Import processing error:', error);
            return {
                success: false,
                message: error.message,
                total: 0,
                imported: 0,
                skipped: 0,
                errors: [error.message]
            };
        }
    }

    /**
     * Generate import summary message
     * @param {Object} results
     * @returns {string}
     */
    static generateImportMessage(results) {
        const { total, imported, skipped, duplicates } = results;

        if (imported === 0) {
            return `Import selesai: ${total} baris diproses, tidak ada data yang berhasil diimport`;
        }

        let message = `Import berhasil: ${imported} dari ${total} baris diimport`;
        if (duplicates > 0) {
            message += `, ${duplicates} duplikat dilewati`;
        }
        if (skipped - duplicates > 0) {
            message += `, ${skipped - duplicates} error`;
        }

        return message;
    }
}

module.exports = AttendanceImportService;
