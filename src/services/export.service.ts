// src/services/export.service.ts
// Layanan (Service) pembantu untuk menulis data absensi ke berkas fisik di server
// sebelum diunduh oleh client. Mendukung pembuatan berkas Excel (menggunakan exceljs),
// PDF (menggunakan pdfkit), dan berkas teks CSV standar.

import ExcelJS from 'exceljs'; // Library pembuat lembar kerja Excel (.xlsx)
import PDFDocument from 'pdfkit'; // Library pembuat dokumen PDF
import fs from 'fs'; // Modul bawaan Node.js untuk manipulasi berkas/sistem file
import path from 'path'; // Modul bawaan Node.js untuk manipulasi path direktori

// Memastikan folder penyimpanan berkas ekspor exists di root project
const exportsDir = path.join(__dirname, '../../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

export type ExportFormatType = 'excel' | 'pdf' | 'csv';

/**
 * Fungsi pembungkus utama ekspor log absensi detail.
 * @param data - Kumpulan data absensi
 * @param format - Format keluaran (excel/pdf/csv)
 * @param filename - Nama berkas
 * @returns Path absolute lokasi file yang berhasil dibuat
 */
export async function exportData(
  data: Record<string, unknown>[],
  format: ExportFormatType,
  filename: string
): Promise<string> {
  const filePath = path.join(exportsDir, `${filename}.${format === 'excel' ? 'xlsx' : format}`);

  switch (format) {
    case 'excel':
      return await exportToExcel(data, filePath);
    case 'pdf':
      return await exportToPDF(data, filePath);
    case 'csv':
      return await exportToCSV(data, filePath);
    default:
      throw new Error('Format ekspor tidak didukung');
  }
}

/**
 * Fungsi pembungkus utama ekspor rekapitulasi/summary absensi.
 * @param data - Kumpulan data rekapitulasi
 * @param format - Format keluaran (excel/pdf/csv)
 * @param filename - Nama berkas
 * @returns Path lokasi file
 */
export async function exportSummaryData(
  data: Record<string, unknown>[],
  format: ExportFormatType,
  filename: string
): Promise<string> {
  const filePath = path.join(exportsDir, `${filename}.${format === 'excel' ? 'xlsx' : format}`);

  switch (format) {
    case 'excel':
      return await exportSummaryToExcel(data, filePath);
    case 'pdf':
      return await exportSummaryToPDF(data, filePath);
    case 'csv':
      return await exportSummaryToCSV(data, filePath);
    default:
      throw new Error('Format ekspor tidak didukung');
  }
}

/**
 * Menulis data absensi detail ke file Excel (.xlsx).
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data Absensi');

  // Menentukan nama kolom header dan lebar kolom masing-masing
  sheet.columns = [
    { header: 'Cloud ID', key: 'cloud_id', width: 15 },
    { header: 'Device ID', key: 'device_id', width: 15 },
    { header: 'User ID', key: 'user_id', width: 15 },
    { header: 'Nama', key: 'nama', width: 25 },
    { header: 'Tanggal Absensi', key: 'tanggal_absensi', width: 18 },
    { header: 'Waktu Absensi', key: 'waktu_absensi', width: 15 },
    { header: 'Verifikasi', key: 'verifikasi', width: 15 },
    { header: 'Tipe Absensi', key: 'tipe_absensi', width: 15 },
    { header: 'Tanggal Upload', key: 'tanggal_upload', width: 18 },
    { header: 'Kategori User', key: 'kategori_user', width: 15 },
  ];

  // Mengubah font baris header (baris pertama) menjadi tebal (bold)
  const row1 = sheet.getRow(1);
  row1.font = { bold: true };

  // Memasukkan seluruh data absen ke baris lembar kerja
  data.forEach((record) => sheet.addRow(record));

  // Menulis isi workbook ke file fisik
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Menulis data absensi detail ke dokumen PDF.
 */
export async function exportToPDF(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath)); // Stream data PDF ke file tujuan

  // Judul Halaman PDF
  doc.fontSize(20).text('Laporan Absensi Kampus', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Total Baris Data: ${data.length}`, { align: 'left' });
  doc.moveDown();

  const headers = ['No', 'Nama', 'User ID', 'Tanggal', 'Waktu', 'Tipe'];
  let yPosition = doc.y + 20;

  // Render header tabel PDF
  headers.forEach((header, index) => {
    doc.fontSize(10).text(header, 50 + index * 80, yPosition, { width: 70, align: 'center' });
  });

  doc.moveDown();

  // Iterasi data absensi dan menggambarnya baris per baris ke PDF
  data.forEach((record, index) => {
    // Tambahkan halaman baru jika koordinat y melebihi batas bawah halaman (700)
    if (yPosition > 700) {
      doc.addPage();
      yPosition = 50;
    }

    const rowData = [
      (index + 1).toString(),
      String(record['nama'] ?? ''),
      String(record['user_id'] ?? ''),
      String(record['tanggal_absensi'] ?? ''),
      String(record['waktu_absensi'] ?? ''),
      String(record['tipe_absensi'] ?? ''),
    ];

    rowData.forEach((cell, cellIndex) => {
      doc.fontSize(8).text(cell, 50 + cellIndex * 80, yPosition, { width: 70, align: 'center' });
    });

    yPosition += 15;
  });

  doc.end(); // Menyelesaikan penulisan dokumen PDF
  return new Promise((resolve) => {
    doc.on('end', () => resolve(filePath));
  });
}

/**
 * Menulis data absensi detail ke berkas teks CSV (Comma Separated Values).
 */
export async function exportToCSV(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const headers = [
    'cloud_id',
    'device_id',
    'user_id',
    'nama',
    'tanggal_absensi',
    'waktu_absensi',
    'verifikasi',
    'tipe_absensi',
    'tanggal_upload',
    'kategori_user',
  ];
  const headerLabels = [
    'Cloud ID',
    'Device ID',
    'User ID',
    'Nama',
    'Tanggal Absensi',
    'Waktu Absensi',
    'Verifikasi',
    'Tipe Absensi',
    'Tanggal Upload',
    'Kategori User',
  ];

  // Menyusun baris header CSV
  const rows = [headerLabels.join(',')];
  data.forEach((record) => {
    // Membungkus nilai sel dengan tanda kutip ganda dan meloloskan tanda kutip di dalamnya
    const row = headers.map((h) => `"${String(record[h] ?? '').replace(/"/g, '""')}"`);
    rows.push(row.join(','));
  });

  // Tulis dengan penambahan karakter Byte Order Mark (\uFEFF) UTF-8 agar Excel dapat membaca tanda aksen
  fs.writeFileSync(filePath, '\uFEFF' + rows.join('\n'), 'utf8');
  return filePath;
}

/**
 * Menulis rekapitulasi/summary absensi pegawai ke file Excel (.xlsx).
 */
export async function exportSummaryToExcel(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap Data');

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Nama', key: 'nama', width: 25 },
    { header: 'User ID', key: 'user_id', width: 15 },
    { header: 'Jabatan', key: 'jabatan', width: 12 },
    { header: 'Hadir', key: 'hadir', width: 8 },
    { header: 'Total Hari Kerja', key: 'total_hari_kerja', width: 16 },
    { header: 'Terlambat', key: 'terlambat', width: 10 },
    { header: 'Persentase', key: 'persentase', width: 12 },
    { header: 'Check In Terakhir', key: 'check_in_terakhir', width: 18 },
    { header: 'Check Out Terakhir', key: 'check_out_terakhir', width: 18 },
  ];

  const row1 = sheet.getRow(1);
  row1.font = { bold: true };

  data.forEach((record) => sheet.addRow(record));

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Menulis rekapitulasi/summary absensi pegawai ke dokumen PDF sederhana.
 */
export async function exportSummaryToPDF(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(16).text('Rekap Absensi', { align: 'center' });
  doc.moveDown();

  data.forEach((record) => {
    doc.fontSize(12).text(`No: ${String(record['no'] ?? '')}`);
    doc.text(`Nama: ${String(record['nama'] ?? '')}`);
    doc.text(`User ID: ${String(record['user_id'] ?? '')}`);
    doc.text(`Jabatan: ${String(record['jabatan'] ?? '')}`);
    doc.text(`Hadir: ${String(record['hadir'] ?? '')}`);
    doc.text(`Total Hari Kerja: ${String(record['total_hari_kerja'] ?? '')}`);
    doc.text(`Terlambat: ${String(record['terlambat'] ?? '')}`);
    doc.text(`Persentase: ${String(record['persentase'] ?? '')}%`);
    doc.text(`Check In Terakhir: ${String(record['check_in_terakhir'] || 'N/A')}`);
    doc.text(`Check Out Terakhir: ${String(record['check_out_terakhir'] || 'N/A')}`);
    doc.moveDown();
  });

  doc.end();
  return filePath;
}

/**
 * Menulis rekapitulasi/summary absensi pegawai ke file CSV.
 */
export async function exportSummaryToCSV(
  data: Record<string, unknown>[],
  filePath: string
): Promise<string> {
  const headers = [
    'no',
    'nama',
    'user_id',
    'jabatan',
    'hadir',
    'total_hari_kerja',
    'terlambat',
    'persentase',
    'check_in_terakhir',
    'check_out_terakhir',
  ];
  const headerLabels = [
    'No',
    'Nama',
    'User ID',
    'Jabatan',
    'Hadir',
    'Total Hari Kerja',
    'Terlambat',
    'Persentase',
    'Check In Terakhir',
    'Check Out Terakhir',
  ];

  const rows = [headerLabels.join(',')];
  data.forEach((record) => {
    const row = headers.map((h) => `"${String(record[h] ?? '').replace(/"/g, '""')}"`);
    rows.push(row.join(','));
  });

  fs.writeFileSync(filePath, '\uFEFF' + rows.join('\n'), 'utf8');
  return filePath;
}
