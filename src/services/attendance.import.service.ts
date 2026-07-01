// src/services/attendance.import.service.ts
// Layanan (Service) ini menangani parsing, validasi, pendeteksian format,
// dan pemrosesan impor berkas absensi sidik jari (dari format asli ekspor Fingerspot
// maupun format berkas template manual Excel/CSV).
// Layanan ini memproses data secara berurutan dan menyimpannya ke database via Prisma transaction.

import * as xlsx from 'xlsx'; // Library untuk parsing format lembar kerja Excel/CSV
import prisma from '../config/prisma'; // Prisma client untuk manipulasi data DB
import logger from '../utils/logger'; // Logger aplikasi

export interface ImportOptions {
  skipDuplicates?: boolean; // Pilihan apakah baris data duplikat dilewati atau menghasilkan error
}

export interface ParsedRow {
  user_id: string; // ID pegawai/NIK
  nama: string;
  tanggal: Date;
  waktu: string;
  isCheckIn: boolean; // Menandakan apakah aksi masuk (check-in) atau pulang (check-out)
  verifikasi: string; // Metode verifikasi (FINGER, FACE, PASSWORD, dll)
}

export interface FingerspotGroupedRecord {
  user_id: string;
  nama: string;
  tanggal: Date;
  entries: { waktu: Date; isCheckIn: boolean }[]; // Daftar log absensi pada tanggal yang sama
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
  message: string; // Deskripsi hasil ringkasan impor
  total: number; // Total data yang masuk untuk diproses
  imported: number; // Jumlah log yang berhasil masuk ke database
  skipped: number; // Jumlah baris yang dilewati (karena error atau duplikat)
  duplicates: number; // Jumlah baris duplikat terdeteksi
  errors: string[]; // Daftar pesan kesalahan detail
  warnings?: string[] | undefined; // Daftar peringatan (misal pegawai baru dibuat otomatis)
  duplicateDetails?: any[] | undefined; // Cuplikan detail log yang duplikat
}

export class AttendanceImportService {
  /**
   * Mengurai buffer file Excel/CSV menjadi array of objects.
   * @param buffer - Buffer file dari request upload
   * @param filename - Nama asli berkas
   * @returns Array objek baris data
   */
  public static async parseImportFile(
    buffer: Buffer,
    filename: string
  ): Promise<Record<string, string | null>[]> {
    try {
      // Membaca berkas workbook dari buffer memori menggunakan library xlsx
      const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });

      // Mengambil nama sheet pertama
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('File tidak memiliki sheet yang valid');
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('File tidak memiliki sheet yang valid');
      }

      // Mengonversi isi sheet ke array JSON
      const rawData = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: null, // Nilai default untuk sel kosong adalah null
      });
      const data: Record<string, string | null>[] = [];

      for (const row of rawData) {
        const rowObj: Record<string, string | null> = {};
        for (const [key, val] of Object.entries(row)) {
          let strVal: string | null = null;
          if (val === null || val === undefined) {
            strVal = null;
          } else if (val instanceof Date) {
            // Memformat objek tanggal dari Excel secara aman ke format YYYY-MM-DD
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            strVal = `${y}-${m}-${d}`;
          } else {
            strVal = String(val);
          }
          // Bersihkan spasi berlebih pada nama kolom/key
          const cleanKey = key.trim();
          rowObj[cleanKey] = strVal;
        }

        // Hanya masukkan baris yang memiliki minimal satu sel berisi data
        if (Object.values(rowObj).some((v) => v !== null && v !== '')) {
          data.push(rowObj);
        }
      }

      logger.info(`Berhasil membaca ${data.length} baris dari berkas ${filename}`);
      return data;
    } catch (error) {
      logger.error('Error saat parsing file:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Gagal membaca file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Mendeteksi format file impor (Format ekspor mesin Fingerspot vs Format Template Absensi Manual).
   * @param rows - Array baris mentah yang telah diparsing
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

    logger.info('Mendeteksi format berkas', { columns });

    // Kolom-kolom penanda format ekspor dari Fingerspot
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
      logger.info('Format terdeteksi sebagai format FINGERSPOT');
      return 'FINGERSPOT';
    }

    // Kolom-kolom penanda format template manual sistem
    const templateColumns = ['user_id', 'tanggal', 'jam_masuk'];
    const hasTemplateColumns = templateColumns.every((col) => columns.includes(col));

    if (hasTemplateColumns) {
      logger.info('Format terdeteksi sebagai TEMPLATE manual');
      return 'TEMPLATE';
    }

    logger.warn('Format berkas tidak dikenali', { columns });
    return 'UNKNOWN';
  }

  /**
   * Mengurai baris data format ekspor Fingerspot menjadi objek terstandarisasi.
   * @param row - Baris data Fingerspot
   * @param index - Index baris
   * @returns Hasil parse atau null jika tidak valid
   */
  public static parseFingerspotRow(
    row: Record<string, string | null>,
    index: number
  ): ParsedRow | null {
    try {
      const user_id = String(row['NIK'] || row['ID'] || '').trim();
      
      // --- BLACKLIST MELINDA ---
      if (user_id === '1') {
        logger.warn(`[BLACKLIST] Mengabaikan data baris Fingerspot milik Melinda (ID 1)`);
        return null; // Abaikan baris ini sepenuhnya
      }

      const nama = String(row['Nama'] || '').trim();
      const tanggalStr = String(row['Tanggal Absensi'] || row['Tanggal Ab'] || '').trim();
      const waktuStr = String(row['Waktu Absensi'] || row['Waktu Abs'] || '').trim();
      const tipeAbsen = String(row['Tipe Absensi'] || row['Tipe Absen'] || '').trim();
      const verifikasi = String(row['Verifikasi'] || 'Sidik Jari').trim();

      // Baris tidak valid jika data penting kosong
      if (!user_id || !tanggalStr || !waktuStr) {
        return null;
      }

      // Mengurai string tanggal
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
        logger.warn(`Format tanggal tidak valid pada baris ${index + 2}:`, { tanggalStr });
        return null;
      }

      // Mengurai format waktu
      let waktu = waktuStr.trim();
      if (waktu && !waktu.includes(':')) {
        return null;
      }
      if (waktu.split(':').length === 2) {
        waktu += ':00'; // Tambahkan detik default jika hanya ada jam:menit
      }

      const tipeNormalized = tipeAbsen.toLowerCase();
      // Mengklasifikasikan tipe scan (jika mengandung kata pulang maka check-out, selain itu check-in masuk)
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
      logger.error(`Error parsing baris Fingerspot ${index + 2}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Mengelompokkan log scan mentah Fingerspot berdasarkan NIP pegawai dan Tanggal,
   * untuk menentukan jam masuk (scan pertama) dan jam keluar (scan terakhir) dalam hari tersebut.
   */
  public static groupFingerspotData(parsedRows: ParsedRow[]): GroupedImportResult[] {
    const grouped: Record<string, FingerspotGroupedRecord> = {};

    parsedRows.forEach((row) => {
      if (!row) return;

      const y = row.tanggal.getUTCFullYear();
      const m = String(row.tanggal.getUTCMonth() + 1).padStart(2, '0');
      const d = String(row.tanggal.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const key = `${row.user_id}_${dateStr}`; // Kunci pengelompokan (NIP_Tanggal)

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

      // Menggabungkan tanggal dan jam scan
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
      // Urutkan entri scan dari waktu terkecil ke terbesar
      group.entries.sort((a, b) => a.waktu.getTime() - b.waktu.getTime());

      let jam_masuk: Date | null = null;
      let jam_keluar: Date | null = null;

      if (group.entries.length > 0) {
        // Logika Pencegahan Duplikasi (Konsisten dengan zk-sync)
        // Ambil elemen pertama sebagai jam_masuk terlepas dari jam berapapun
        const first = group.entries[0];
        if (first) {
          jam_masuk = first.waktu;
        }

        // Cari elemen terakhir yang berjarak minimal 2 jam (120 menit) dari jam_masuk
        // Jika semua scan dalam rentang 2 jam, maka tidak ada jam_keluar (mencegah duplikat sesi pagi jadi jam pulang)
        const last = group.entries[group.entries.length - 1];
        if (last && first && (last.waktu.getTime() - first.waktu.getTime() >= 120 * 60 * 1000)) {
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
   * Memvalidasi kebenaran data pada satu baris template manual Excel.
   * @param row - Baris data
   * @param index - Index baris
   * @returns Kelayakan validasi beserta data ter-format
   */
  public static async validateRow(
    row: Record<string, string | null>,
    index: number
  ): Promise<{ valid: boolean; errors: string[]; data: any }> {
    const errors: string[] = [];
    const rowNum = index + 2; // Baris Excel (1-based + baris header)

    // Validasi input NIDN/NIP (user_id)
    if (!row['user_id'] || String(row['user_id']).trim() === '') {
      errors.push(`Baris ${rowNum}: User ID wajib diisi`);
      return { valid: false, errors, data: null };
    }

    const user_id = String(row['user_id']).trim();

    // --- BLACKLIST MELINDA ---
    if (user_id === '1') {
      errors.push(`Baris ${rowNum}: User ID '1' (Melinda) masuk dalam daftar blacklist sistem`);
      return { valid: false, errors, data: null };
    }

    // Pastikan pegawai terdaftar di database
    let employee: any;
    try {
      employee = await prisma.employees.findUnique({
        where: { user_id },
      });
    } catch (error) {
      logger.error('Error saat mencari data pegawai:', {
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

    // Validasi keberadaan kolom tanggal
    if (!row['tanggal'] || String(row['tanggal']).trim() === '') {
      errors.push(`Baris ${rowNum}: Tanggal wajib diisi`);
      return { valid: false, errors, data: null };
    }

    // Validasi kesesuaian format tanggal
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
          throw new Error('Tanggal tidak valid');
        }
        y = temp.getFullYear();
        m = temp.getMonth() + 1;
        day = temp.getDate();
      }
      tanggal = new Date(Date.UTC(y, m - 1, day));
    } catch (_error) {
      errors.push(`Baris ${rowNum}: Format tanggal tidak valid (gunakan format YYYY-MM-DD)`);
      return { valid: false, errors, data: null };
    }

    // Validasi jam masuk
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

    // Validasi jam keluar (opsional)
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

    // Jabatan opsional di excel, jika kosong ambil dari DB pegawai
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
   * Memeriksa apakah log absensi yang diimpor sudah ada (duplikat) di DB.
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
      logger.error('Error saat memeriksa duplikasi log:', {
        user_id,
        tanggal,
        jamMasuk,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Memproses dan menyimpan data impor khusus format Fingerspot.
   */
  public static async processFingerspotImport(
    rows: Record<string, string | null>[],
    options: ImportOptions = {}
  ): Promise<ImportResultReport> {
    const { skipDuplicates = true } = options;

    try {
      logger.info(`Memulai pemrosesan impor Fingerspot dengan ${rows.length} baris`);

      const parsedRows = rows
          .map((row, index) => this.parseFingerspotRow(row, index))
          .filter((row): row is ParsedRow => row !== null);

      logger.info(`Berhasil mem-parsing ${parsedRows.length} baris valid format Fingerspot`);

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
      logger.info(`Dikelompokkan menjadi ${grouped.length} rekaman absensi harian`);

      const results = {
        total: grouped.length,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: [] as string[],
        warnings: [] as string[],
      };

      const validRecords: any[] = [];
      const duplicateRecords: any[] = [];

      for (let i = 0; i < grouped.length; i++) {
        const record = grouped[i];
        if (!record) continue;

        // Cek data master pegawai
        let employee: any;
        try {
          employee = await prisma.employees.findUnique({
            where: { user_id: record.user_id },
          });

          // Jika pegawai belum ada di database, buat otomatis demi kelancaran impor
          if (!employee) {
            logger.info(`Auto-creating employee User ID ${record.user_id} dari data import`);
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
              `User ID ${record.user_id} (${String(employee.nama)}) dibuat otomatis sebagai KARYAWAN - silakan sesuaikan jabatannya nanti`
            );
          }
        } catch (error) {
          logger.error('Error saat menelusuri/membuat pegawai:', {
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

        // Cek duplikasi record di database
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

      // Memasukkan data valid ke database secara massal (batch insert) menggunakan prisma transaction
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
          logger.info(`Berhasil mengimpor ${validRecords.length} log absensi Fingerspot`);
        } catch (error) {
          logger.error('Error saat menyimpan batch ke database:', {
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
      logger.error('Error pemrosesan impor Fingerspot:', {
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
   * Titik masuk utama (entry point) pemrosesan impor berkas.
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

      // Deteksi format berkas
      const format = this.detectFileFormat(rows);
      logger.info(`Format berkas terdeteksi: ${format}`);

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
      logger.error('Error saat pemrosesan impor file:', {
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
   * Memproses data impor dalam format Template Absensi Manual.
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

      const validRecords: any[] = [];
      const duplicateRecords: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        // Validasi kebenaran struktur data baris
        const validation = await this.validateRow(row, i);

        if (!validation.valid) {
          logger.warn(`Validasi baris ${i + 2} gagal:`, { errors: validation.errors });
          results.errors.push(...validation.errors);
          results.skipped++;
          continue;
        }

        // Cek duplikasi di DB
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
              `Baris ${i + 2}: Data duplikat ditemukan (pembaruan data belum didukung)`
            );
            results.skipped++;
            continue;
          }
        }

        validRecords.push(validation.data);
      }

      // Batch insert ke database
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
            `Berhasil mengimpor ${validRecords.length} log absensi dari template manual`
          );
        } catch (error) {
          logger.error('Error saat melakukan batch insert ke DB:', {
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
      logger.error('Error saat memproses template impor:', {
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
   * Menghasilkan string kesimpulan/summary hasil impor.
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
