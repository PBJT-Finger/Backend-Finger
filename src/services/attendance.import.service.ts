import * as xlsx from 'xlsx';
import prisma from '../config/prisma';
import logger from '../utils/logger';

export interface ImportOptions {
  skipDuplicates?: boolean;
}

export interface ParsedRow {
  user_id: string;
  nama: string;
  tanggal: Date;
  waktu: string;
  isCheckIn: boolean;
  verifikasi: string;
}

export interface FingerspotGroupedRecord {
  user_id: string;
  nama: string;
  tanggal: Date;
  entries: { waktu: Date; isCheckIn: boolean }[];
  verification_method: string;
  status: string;
}

export interface GroupedImportResult {
  user_id: string;
  nama: string;
  tanggal: Date;
  jam_masuk: Date | null;
  jam_keluar: Date | null;
  verification_method: string;
  status: string;
}

export interface ImportResultReport {
  success: boolean;
  message: string;
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
  warnings?: string[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicateDetails?: any[] | undefined;
}

export class AttendanceImportService {
  /**
   * Parse Excel/CSV file buffer to array of objects
   * @param buffer - File buffer
   * @param filename - Original filename
   * @returns Array of row objects
   */
  public static async parseImportFile(
    buffer: Buffer,
    filename: string
  ): Promise<Record<string, string | null>[]> {
    try {
      // Read workbook from buffer using xlsx (SheetJS)
      const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('File tidak memiliki sheet yang valid');
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('File tidak memiliki sheet yang valid');
      }

      // Convert sheet to json array
      const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: null,
      });
      const data: Record<string, string | null>[] = [];

      for (const row of rawData) {
        const rowObj: Record<string, string | null> = {};
        for (const [key, val] of Object.entries(row)) {
          let strVal: string | null = null;
          if (val === null || val === undefined) {
            strVal = null;
          } else if (val instanceof Date) {
            // Format date as YYYY-MM-DD
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            strVal = `${y}-${m}-${d}`;
          } else {
            strVal = String(val);
          }
          // The key might have leading/trailing spaces
          const cleanKey = key.trim();
          rowObj[cleanKey] = strVal;
        }

        // Only push rows that have at least one value
        if (Object.values(rowObj).some((v) => v !== null && v !== '')) {
          data.push(rowObj);
        }
      }

      logger.info(`Parsed ${data.length} rows from ${filename}`);
      return data;
    } catch (error) {
      logger.error('File parsing error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Gagal membaca file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Detect file format (Fingerspot export vs Template manual)
   * @param rows - Parsed rows from Excel
   * @returns 'FINGERSPOT' | 'TEMPLATE' | 'UNKNOWN'
   */
  public static detectFileFormat(
    rows: Record<string, string | null>[]
  ): 'FINGERSPOT' | 'TEMPLATE' | 'UNKNOWN' {
    if (!rows || rows.length === 0) {
      return 'UNKNOWN';
    }

    const firstRow = rows[0];
    if (!firstRow) return 'UNKNOWN';
    const columns = Object.keys(firstRow);

    logger.info('Detecting file format', { columns });

    // Fingerspot format: has specific columns from device export
    const fingerspotColumns = [
      'Cloud ID',
      'Tipe Absen',
      'Waktu Abs',
      'NIK',
      'Tanggal Ab',
      'Tipe Absensi',
      'Waktu Absensi',
      'Tanggal Absensi',
    ];
    const hasFingerspotColumns = fingerspotColumns.some((col) => columns.includes(col));

    if (hasFingerspotColumns) {
      logger.info('Detected Fingerspot format');
      return 'FINGERSPOT';
    }

    // Template format: has our standard columns
    const templateColumns = ['user_id', 'tanggal', 'jam_masuk'];
    const hasTemplateColumns = templateColumns.every((col) => columns.includes(col));

    if (hasTemplateColumns) {
      logger.info('Detected Template format');
      return 'TEMPLATE';
    }

    logger.warn('Unknown file format', { columns });
    return 'UNKNOWN';
  }

  /**
   * Parse Fingerspot row to standard format
   * @param row - Fingerspot row data
   * @param index - Row index
   * @returns Parsed data
   */
  public static parseFingerspotRow(
    row: Record<string, string | null>,
    index: number
  ): ParsedRow | null {
    try {
      const user_id = String(row['NIK'] || row['ID'] || '').trim();
      const nama = String(row['Nama'] || '').trim();
      const tanggalStr = String(row['Tanggal Absensi'] || row['Tanggal Ab'] || '').trim();
      const waktuStr = String(row['Waktu Absensi'] || row['Waktu Abs'] || '').trim();
      const tipeAbsen = String(row['Tipe Absensi'] || row['Tipe Absen'] || '').trim();
      const verifikasi = String(row['Verifikasi'] || 'Sidik Jari').trim();

      if (!user_id || !tanggalStr || !waktuStr) {
        return null; // Invalid row
      }

      // Parse date - handle various formats
      let tanggal: Date;
      try {
        const cleanDateStr = tanggalStr.split(' ')[0] || '';
        if (/^\d{4}-\d{2}-\d{2}/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('-');
          tanggal = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        } else {
          const temp = new Date(tanggalStr);
          tanggal = new Date(Date.UTC(temp.getFullYear(), temp.getMonth(), temp.getDate()));
        }
      } catch (_e) {
        logger.warn(`Invalid date at row ${index + 2}:`, { tanggalStr });
        return null;
      }

      // Parse time - Fingerspot outputs: 17:20 or 08:05
      let waktu = waktuStr.trim();
      if (waktu && !waktu.includes(':')) {
        return null;
      }
      if (waktu.split(':').length === 2) {
        waktu += ':00';
      }

      const tipeNormalized = tipeAbsen.toLowerCase();
      const isCheckIn = tipeNormalized.includes('masuk') || !tipeNormalized.includes('pulang');

      return {
        user_id,
        nama,
        tanggal,
        waktu,
        isCheckIn,
        verifikasi: verifikasi.toUpperCase().replace(' ', '_'),
      };
    } catch (error) {
      logger.error(`Error parsing Fingerspot row ${index + 2}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Group Fingerspot data by NIP and date.
   */
  public static groupFingerspotData(parsedRows: ParsedRow[]): GroupedImportResult[] {
    const grouped: Record<string, FingerspotGroupedRecord> = {};

    parsedRows.forEach((row) => {
      if (!row) return;

      const y = row.tanggal.getUTCFullYear();
      const m = String(row.tanggal.getUTCMonth() + 1).padStart(2, '0');
      const d = String(row.tanggal.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const key = `${row.user_id}_${dateStr}`;

      if (!grouped[key]) {
        grouped[key] = {
          user_id: row.user_id,
          nama: row.nama,
          tanggal: row.tanggal,
          entries: [],
          verification_method: row.verifikasi,
          status: 'HADIR',
        };
      }

      if (!grouped[key].nama && row.nama) {
        grouped[key].nama = row.nama;
      }

      const combineDateTime = (date: Date, timeStr: string): Date => {
        const [hours, minutes, seconds] = timeStr.split(':');
        return new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            parseInt(hours || '0'),
            parseInt(minutes || '0'),
            parseInt(seconds || '0')
          )
        );
      };

      grouped[key].entries.push({
        waktu: combineDateTime(row.tanggal, row.waktu),
        isCheckIn: row.isCheckIn,
      });
    });

    return Object.values(grouped).map((group) => {
      // Sort entries ascending by time
      group.entries.sort((a, b) => a.waktu.getTime() - b.waktu.getTime());

      let jam_masuk: Date | null = null;
      let jam_keluar: Date | null = null;

      if (group.entries.length === 1) {
        const single = group.entries[0];
        if (single) {
          if (single.isCheckIn) {
            jam_masuk = single.waktu;
            jam_keluar = null;
          } else {
            jam_masuk = null;
            jam_keluar = single.waktu;
          }
        }
      } else if (group.entries.length >= 2) {
        const first = group.entries[0];
        const last = group.entries[group.entries.length - 1];
        if (first && last) {
          jam_masuk = first.waktu;
          jam_keluar = last.waktu;
        }
      }

      return {
        user_id: group.user_id,
        nama: group.nama,
        tanggal: group.tanggal,
        jam_masuk,
        jam_keluar,
        verification_method: group.verification_method,
        status: group.status,
      };
    });
  }

  /**
   * Validate single row data
   * @param row - Row data
   * @param index - Row index (for error reporting)
   * @returns { valid: boolean, errors: Array, data: Object }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async validateRow(
    row: Record<string, string | null>,
    index: number
  ): Promise<{ valid: boolean; errors: string[]; data: any }> {
    const errors: string[] = [];
    const rowNum = index + 2; // +2 because: 1-indexed + header row

    // Required: user_id
    if (!row['user_id'] || String(row['user_id']).trim() === '') {
      errors.push(`Baris ${rowNum}: User ID wajib diisi`);
      return { valid: false, errors, data: null };
    }

    const user_id = String(row['user_id']).trim();

    // Check employee exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let employee: any;
    try {
      employee = await prisma.employees.findUnique({
        where: { user_id },
      });
    } catch (error) {
      logger.error('Error looking up employee:', {
        user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push(
        `Baris ${rowNum}: Error database - ${error instanceof Error ? error.message : String(error)}`
      );
      return { valid: false, errors, data: null };
    }

    if (!employee) {
      errors.push(`Baris ${rowNum}: User ID "${user_id}" tidak ditemukan di database`);
      return { valid: false, errors, data: null };
    }

    // Required: Tanggal
    if (!row['tanggal'] || String(row['tanggal']).trim() === '') {
      errors.push(`Baris ${rowNum}: Tanggal wajib diisi`);
      return { valid: false, errors, data: null };
    }

    // Validate date format (YYYY-MM-DD or DD/MM/YYYY)
    let tanggal: Date;
    try {
      const tanggalStr = String(row['tanggal']).trim();
      let y, m, day;

      if (/^\d{4}-\d{2}-\d{2}$/.test(tanggalStr)) {
        const parts = tanggalStr.split('-');
        y = Number(parts[0]);
        m = Number(parts[1]);
        day = Number(parts[2]);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(tanggalStr)) {
        const parts = tanggalStr.split('/');
        y = Number(parts[2]);
        m = Number(parts[1]);
        day = Number(parts[0]);
      } else {
        const temp = new Date(tanggalStr);
        if (isNaN(temp.getTime())) {
          throw new Error('Invalid date');
        }
        y = temp.getFullYear();
        m = temp.getMonth() + 1;
        day = temp.getDate();
      }
      tanggal = new Date(Date.UTC(y, m - 1, day));
    } catch (_error) {
      errors.push(`Baris ${rowNum}: Format tanggal tidak valid (gunakan YYYY-MM-DD)`);
      return { valid: false, errors, data: null };
    }

    // Required: Jam Masuk
    if (!row['jam_masuk'] || String(row['jam_masuk']).trim() === '') {
      errors.push(`Baris ${rowNum}: Jam masuk wajib diisi`);
      return { valid: false, errors, data: null };
    }

    const jamMasukStr = String(row['jam_masuk']).trim();
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(jamMasukStr)) {
      errors.push(`Baris ${rowNum}: Format jam masuk tidak valid (gunakan HH:mm:ss)`);
      return { valid: false, errors, data: null };
    }

    const jamMasuk =
      jamMasukStr.includes(':') && jamMasukStr.split(':').length === 2
        ? `${jamMasukStr}:00`
        : jamMasukStr;

    // Optional: Jam Keluar
    let jamKeluar: string | null = null;
    if (row['jam_keluar'] && String(row['jam_keluar']).trim() !== '') {
      const jamKeluarStr = String(row['jam_keluar']).trim();
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(jamKeluarStr)) {
        errors.push(`Baris ${rowNum}: Format jam keluar tidak valid (gunakan HH:mm:ss)`);
        return { valid: false, errors, data: null };
      }
      jamKeluar =
        jamKeluarStr.includes(':') && jamKeluarStr.split(':').length === 2
          ? `${jamKeluarStr}:00`
          : jamKeluarStr;
    }

    const parseTimeToUtcDate = (timeStr: string | null): Date | null => {
      if (!timeStr) return null;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0] || '0');
      const m = parseInt(parts[1] || '0');
      const s = parseInt(parts[2] || '0');
      return new Date(Date.UTC(1970, 0, 1, h, m, s));
    };

    const jamMasukDate = parseTimeToUtcDate(jamMasuk);
    const jamKeluarDate = parseTimeToUtcDate(jamKeluar);

    // Optional: Jabatan
    let jabatan = employee.jabatan;
    if (row['jabatan'] && String(row['jabatan']).trim() !== '') {
      const jabatanStr = String(row['jabatan']).trim().toUpperCase();
      if (!['DOSEN', 'KARYAWAN'].includes(jabatanStr)) {
        errors.push(`Baris ${rowNum}: Jabatan harus DOSEN atau KARYAWAN`);
        return { valid: false, errors, data: null };
      }
      jabatan = jabatanStr;
    }

    const nama =
      row['nama'] && String(row['nama']).trim() !== '' ? String(row['nama']).trim() : employee.nama;

    const status =
      row['status'] && String(row['status']).trim() !== ''
        ? String(row['status']).trim().toUpperCase()
        : 'HADIR';

    const verificationMethod =
      row['verification_method'] && String(row['verification_method']).trim() !== ''
        ? String(row['verification_method']).trim().toUpperCase()
        : 'MANUAL';

    return {
      valid: true,
      errors: [],
      data: {
        user_id: user_id,
        nama,
        jabatan,
        tanggal,
        jam_masuk: jamMasukDate,
        jam_keluar: jamKeluarDate,
        device_id: 'MANUAL_IMPORT',
        cloud_id: null,
        verification_method: verificationMethod,
        status,
        is_deleted: false,
      },
    };
  }

  /**
   * Check if attendance record is an exact duplicate.
   */
  public static async isDuplicate(
    user_id: string,
    tanggal: Date,
    jamMasuk: Date | string
  ): Promise<boolean> {
    try {
      const jamMasukDate = jamMasuk instanceof Date ? jamMasuk : new Date(jamMasuk);
      const existing = await prisma.attendance.findFirst({
        where: {
          user_id,
          tanggal,
          jam_masuk: jamMasukDate,
          is_deleted: false,
        },
      });

      return existing !== null;
    } catch (error) {
      logger.error('Error checking duplicate:', {
        user_id,
        tanggal,
        jamMasuk,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Process Fingerspot import file
   */
  public static async processFingerspotImport(
    rows: Record<string, string | null>[],
    options: ImportOptions = {}
  ): Promise<ImportResultReport> {
    const { skipDuplicates = true } = options;

    try {
      logger.info(`Processing Fingerspot import with ${rows.length} rows`);

      const parsedRows = rows
        .map((row, index) => this.parseFingerspotRow(row, index))
        .filter((row): row is ParsedRow => row !== null);

      logger.info(`Parsed ${parsedRows.length} valid rows from Fingerspot format`);

      if (parsedRows.length === 0) {
        return {
          success: false,
          message: 'Tidak ada data valid untuk diimport',
          total: rows.length,
          imported: 0,
          skipped: rows.length,
          duplicates: 0,
          errors: ['Tidak ada baris data yang valid'],
        };
      }

      const grouped = this.groupFingerspotData(parsedRows);
      logger.info(`Grouped into ${grouped.length} attendance records`);

      const results = {
        total: grouped.length,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validRecords: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duplicateRecords: any[] = [];

      for (let i = 0; i < grouped.length; i++) {
        const record = grouped[i];
        if (!record) continue;

        // Check employee exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let employee: any;
        try {
          employee = await prisma.employees.findUnique({
            where: { user_id: record.user_id },
          });

          if (!employee) {
            logger.info(`Auto-creating employee User ID ${record.user_id} from import data`);
            employee = await prisma.employees.upsert({
              where: { user_id: record.user_id },
              update: {},
              create: {
                user_id: record.user_id,
                nama: record.nama || `Karyawan ${record.user_id}`,
                jabatan: 'KARYAWAN',
                status: 'AKTIF',
                is_active: true,
              },
            });
            results.warnings.push(
              `User ID ${record.user_id} (${String(employee.nama)}) dibuat otomatis sebagai KARYAWAN - perbarui jabatan via menu Pegawai`
            );
          }
        } catch (error) {
          logger.error('Error looking up/creating employee:', {
            user_id: record.user_id,
            error: error instanceof Error ? error.message : String(error),
          });
          results.errors.push(
            `User ID ${record.user_id}: Error database - ${error instanceof Error ? error.message : String(error)}`
          );
          results.skipped++;
          continue;
        }

        const nama = record.nama || employee.nama;
        const jamMasukUtc = record.jam_masuk
          ? new Date(
              Date.UTC(
                1970,
                0,
                1,
                record.jam_masuk.getUTCHours(),
                record.jam_masuk.getUTCMinutes(),
                record.jam_masuk.getUTCSeconds()
              )
            )
          : null;
        const jamKeluarUtc = record.jam_keluar
          ? new Date(
              Date.UTC(
                1970,
                0,
                1,
                record.jam_keluar.getUTCHours(),
                record.jam_keluar.getUTCMinutes(),
                record.jam_keluar.getUTCSeconds()
              )
            )
          : null;

        const mappedRecord = {
          user_id: employee.user_id,
          nama,
          jabatan: employee.jabatan,
          tanggal: record.tanggal,
          jam_masuk: jamMasukUtc,
          jam_keluar: jamKeluarUtc,
          device_id: 'FINGERSPOT_IMPORT',
          cloud_id: null,
          is_deleted: false,
          verification_method: record.verification_method,
          status: record.status,
        };

        // Check duplicate
        if (mappedRecord.jam_masuk) {
          const isDupe = await this.isDuplicate(
            mappedRecord.user_id,
            mappedRecord.tanggal,
            mappedRecord.jam_masuk
          );
          if (isDupe) {
            if (skipDuplicates) {
              duplicateRecords.push({
                user_id: mappedRecord.user_id,
                nama: mappedRecord.nama,
                tanggal: mappedRecord.tanggal,
                jam_masuk: mappedRecord.jam_masuk,
              });
              results.duplicates++;
              results.skipped++;
              continue;
            }
          }
        }

        validRecords.push(mappedRecord);
      }

      // Batch insert valid records
      if (validRecords.length > 0) {
        try {
          await prisma.$transaction(async (tx) => {
            const batchSize = 100;
            for (let i = 0; i < validRecords.length; i += batchSize) {
              const batch = validRecords.slice(i, i + batchSize);
              await tx.attendance.createMany({
                data: batch,
              });
            }
          });

          results.imported = validRecords.length;
          logger.info(`Successfully imported ${validRecords.length} Fingerspot records`);
        } catch (error) {
          logger.error('Database insert error:', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw new Error(
            `Gagal menyimpan data ke database: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return {
        success: true,
        message: this.generateImportMessage(results),
        ...results,
        duplicateDetails: duplicateRecords.length > 0 ? duplicateRecords.slice(0, 10) : undefined,
        warnings: results.warnings.length > 0 ? results.warnings.slice(0, 10) : undefined,
      };
    } catch (error) {
      logger.error('Fingerspot import processing error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        total: rows.length,
        imported: 0,
        skipped: rows.length,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Process import file and save to database
   */
  public static async processImport(
    fileBuffer: Buffer,
    filename: string,
    options: ImportOptions = {}
  ): Promise<ImportResultReport> {
    try {
      const rows = await this.parseImportFile(fileBuffer, filename);

      if (!rows || rows.length === 0) {
        return {
          success: false,
          message: 'File kosong atau tidak ada data untuk diimport',
          total: 0,
          imported: 0,
          skipped: 0,
          duplicates: 0,
          errors: [],
        };
      }

      const format = this.detectFileFormat(rows);
      logger.info(`Detected format: ${format}`);

      if (format === 'FINGERSPOT') {
        return await this.processFingerspotImport(rows, options);
      } else if (format === 'TEMPLATE') {
        return await this.processTemplateImport(rows, options);
      } else {
        return {
          success: false,
          message:
            'Format file tidak dikenali. Gunakan template import atau file export dari Fingerspot.',
          total: rows.length,
          imported: 0,
          skipped: rows.length,
          duplicates: 0,
          errors: ['Format file tidak valid'],
        };
      }
    } catch (error) {
      logger.error('Import processing error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        total: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Process template format import (original logic)
   */
  public static async processTemplateImport(
    rows: Record<string, string | null>[],
    options: ImportOptions = {}
  ): Promise<ImportResultReport> {
    const { skipDuplicates = true } = options;

    try {
      const results = {
        total: rows.length,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: [] as string[],
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validRecords: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duplicateRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const validation = await this.validateRow(row, i);

        if (!validation.valid) {
          logger.warn(`Row ${i + 2} validation failed:`, { errors: validation.errors });
          results.errors.push(...validation.errors);
          results.skipped++;
          continue;
        }

        const isDuplicate = await this.isDuplicate(
          validation.data.user_id,
          validation.data.tanggal,
          validation.data.jam_masuk
        );

        if (isDuplicate) {
          if (skipDuplicates) {
            duplicateRecords.push({
              row: i + 2,
              user_id: validation.data.user_id,
              tanggal: validation.data.tanggal,
              jam_masuk: validation.data.jam_masuk,
            });
            results.duplicates++;
            results.skipped++;
            continue;
          } else {
            results.errors.push(
              `Baris ${i + 2}: Data duplikat ditemukan (update belum diimplementasi)`
            );
            results.skipped++;
            continue;
          }
        }

        validRecords.push(validation.data);
      }

      if (validRecords.length > 0) {
        try {
          await prisma.$transaction(async (tx) => {
            const batchSize = 100;
            for (let i = 0; i < validRecords.length; i += batchSize) {
              const batch = validRecords.slice(i, i + batchSize);
              await tx.attendance.createMany({
                data: batch,
              });
            }
          });

          results.imported = validRecords.length;
          logger.info(
            `Successfully imported ${validRecords.length} attendance records from template import`
          );
        } catch (error) {
          logger.error('Database insert error:', {
            error: error instanceof Error ? error.message : String(error),
          });
          throw new Error(
            `Gagal menyimpan data ke database: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return {
        success: true,
        message: this.generateImportMessage(results),
        ...results,
        duplicateDetails: duplicateRecords.length > 0 ? duplicateRecords : undefined,
      };
    } catch (error) {
      logger.error('Import processing error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        total: 0,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate import summary message
   */
  public static generateImportMessage(results: {
    total: number;
    imported: number;
    skipped: number;
    duplicates: number;
  }): string {
    const { total, imported, skipped, duplicates } = results;

    if (imported === 0) {
      let msg = `Import selesai: ${total} baris diproses, tidak ada data baru yang berhasil diimport`;
      if (duplicates > 0) {
        msg += ` (${duplicates} data duplikat dilewati)`;
      }
      return msg;
    }

    let message = `Import berhasil: ${imported} dari ${total} baris diimport`;
    if (duplicates > 0) {
      message += `, ${duplicates} duplikat dilewati`;
    }
    if (skipped - duplicates > 0) {
      message += `, ${skipped - duplicates} dilewati karena error/warning`;
    }

    return message;
  }
}
export default AttendanceImportService;
