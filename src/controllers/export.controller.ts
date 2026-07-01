// src/controllers/export.controller.ts
// Kontroler ini bertanggung jawab untuk mengekspor data rekapitulasi absensi pegawai ke berbagai format file:
// Excel (.xlsx), PDF (.pdf), dan CSV (.csv). 
// Data yang diekspor disaring berdasarkan rentang tanggal/bulan, jabatan (Dosen/Karyawan), 
// dan ID pegawai tertentu, lengkap dengan Kop Surat institusi (Politeknik Baja Tegal) pada laporan PDF.

import { Request, Response } from 'express';
import prisma from '../config/prisma'; // Prisma client untuk akses database
import { errorResponse } from '../utils/responseFormatter'; // Util format respon error API
import logger from '../utils/logger'; // Logger aplikasi
import ExcelJS from 'exceljs'; // Library untuk generate file Excel
import PDFDocument from 'pdfkit'; // Library untuk generate file PDF
import path from 'path'; // Module internal Node.js untuk resolusi path file
import fs from 'fs'; // Module internal Node.js untuk operasi file system

import {
  extractTimeString,
  formatDateID,
  transformDosenAttendance,
  transformKaryawanAttendance,
  RawAttendanceRecord,
  calculateWorkingDays,
} from '../utils/attendanceTransformer'; // Helper transformasi data kehadiran dan perhitungan hari kerja

// Helper pembantu untuk format waktu (jam:menit) secara aman
const formatTimeFixed = (timeVal: string | Date | null): string => {
  if (!timeVal) return '-';
  return extractTimeString(timeVal) || '-';
};

export class ExportController {
  /**
   * Mengekspor ringkasan (summary) kehadiran pegawai ke berkas Excel.
   * GET /api/export/excel?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToExcel(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      // Konversi jika parameter yang dikirim adalah bulan & tahun
      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      // Pastikan rentang tanggal sudah ditentukan
      if (!startDate || !endDate) {
        return errorResponse(res, 'Tanggal mulai/selesai ATAU bulan/tahun harus diisi', 400);
      }

      // Query raw SQL untuk grouping absensi per tanggal per pegawai agar tidak ada duplikasi data scan masuk/keluar
      let sql = `
        SELECT a.tanggal, a.user_id, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;

      const params: any[] = [startDate, endDate];

      // Tambahkan filter jabatan jika ada
      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      // Tambahkan filter user_id jika ada
      if (id || user_id) {
        sql += ' AND a.user_id = ?';
        params.push(id || user_id);
      }

      sql += ' GROUP BY a.tanggal, a.user_id, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await prisma.$queryRawUnsafe<RawAttendanceRecord[]>(sql, ...params);

      // Jika data tidak ditemukan, batalkan proses ekspor
      if (attendance.length === 0) {
        return errorResponse(res, 'Data absensi tidak ditemukan untuk diekspor', 404);
      }

      // Mengambil data pegawai aktif untuk pemetaan nama yang ter-update
      const activeEmployees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, jabatan: true },
      });
      const employeeMap = new Map(activeEmployees.map((e) => [e.user_id, e]));
      const mappedAttendance = attendance.map((a) => {
        const emp = a.user_id ? employeeMap.get(a.user_id) : null;
        return {
          ...a,
          nama: emp?.nama ?? a.nama,
          jabatan: emp?.jabatan ?? a.jabatan,
        };
      });

      // Mengambil daftar libur nasional dalam periode ekspor
      const holidayWhere: any = {};
      const startLocalDate = startDate ? new Date(startDate) : null;
      const endLocalDate = endDate ? new Date(endDate) : null;
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }
      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      const holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })
      );

      // Menghitung total hari kerja efektif dalam periode ekspor
      const totalWorkingDays = await calculateWorkingDays(startDate, endDate);

      // Transformasi data absensi berdasarkan jabatan (Dosen atau Karyawan)
      let transformedData: any[];
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      } else {
        transformedData = transformKaryawanAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      }

      // Membuat workbook Excel baru menggunakan ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Absensi');

      // Mendefinisikan kolom lembar kerja Excel — kolom Terlambat hanya untuk Dosen
      const isDosen = jabatan === 'DOSEN';
      worksheet.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Nama', key: 'nama', width: 28 },
        { header: 'Hari Kerja Target', key: 'total_hari_kerja', width: 18 },
        { header: 'Hadir', key: 'hadir', width: 10 },
        ...(isDosen ? [{ header: 'Terlambat', key: 'terlambat', width: 12 }] : []),
        { header: 'Tidak Hadir', key: 'tidak_hadir', width: 12 },
        { header: 'Persentase', key: 'persentase', width: 12 },
      ];

      // Memasukkan setiap data baris rekap ke Excel
      transformedData.forEach((record, index) => {
        const row: Record<string, any> = {
          no: index + 1,
          nama: record.nama || '-',
          total_hari_kerja: record.totalHariKerja || 0,
          hadir: record.totalHadir || 0,
          tidak_hadir: record.tidakHadir || 0,
          persentase: `${record.persentase || 0}%`,
        };
        // Hanya sertakan kolom terlambat untuk Dosen
        if (isDosen) row['terlambat'] = record.totalTerlambat || 0;
        worksheet.addRow(row);
      });

      // Membuat teks baris header menjadi tebal (Bold)
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Menghasilkan buffer file Excel di memori
      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

      // Mengatur header HTTP agar browser mengunduh berkas sebagai file attachment Excel
      const filename = `rekap-absensi-summary-${String(jabatan || 'all')}-${startDate}-to-${endDate}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const actorId = req.user?.id ?? 0;
      logger.info('Proses ekspor summary Excel berhasil dibuat', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });

      res.send(buffer);
      return;
    } catch (error) {
      logger.error('Error ekspor Excel summary', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengekspor data rekap ke Excel', 500);
    }
  }

  /**
   * Mengekspor detail riwayat absensi harian pegawai ke berkas Excel.
   * GET /api/export/excel-detail?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToExcelDetail(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Tanggal mulai/selesai ATAU bulan/tahun harus diisi', 400);
      }

      // Query data absensi detail harian dari DB
      let sql = `
        SELECT a.tanggal, a.user_id, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;

      const params: any[] = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || user_id) {
        sql += ' AND a.user_id = ?';
        params.push(id || user_id);
      }

      sql += ' GROUP BY a.tanggal, a.user_id, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await prisma.$queryRawUnsafe<RawAttendanceRecord[]>(sql, ...params);

      if (attendance.length === 0) {
        return errorResponse(res, 'Data tidak ditemukan untuk diekspor', 404);
      }

      const activeEmployees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, jabatan: true },
      });
      const employeeMap = new Map(activeEmployees.map((e) => [e.user_id, e]));
      const mappedAttendance = attendance.map((a) => {
        const emp = a.user_id ? employeeMap.get(a.user_id) : null;
        return {
          ...a,
          nama: emp?.nama ?? a.nama,
          jabatan: emp?.jabatan ?? a.jabatan,
        };
      });

      // Format data untuk baris detail harian Excel
      const excelData = mappedAttendance.map((record) => ({
        Tanggal: formatDateID(record.tanggal),
        ID: record.user_id || '',
        Nama: record.nama || '',
        'Jam Masuk': formatTimeFixed(record.jam_masuk),
        'Jam Keluar': formatTimeFixed(record.jam_keluar),
        Status: record.status || '',
      }));

      // Inisialisasi sheet baru
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Detail Absensi');

      worksheet.columns = [
        { header: 'Tanggal', key: 'Tanggal', width: 15 },
        { header: 'ID', key: 'ID', width: 15 },
        { header: 'Nama', key: 'Nama', width: 25 },
        { header: 'Jam Masuk', key: 'Jam Masuk', width: 14 },
        { header: 'Jam Keluar', key: 'Jam Keluar', width: 14 },
        { header: 'Status', key: 'Status', width: 12 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Masukkan baris data
      excelData.forEach((row) => worksheet.addRow(row));

      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

      const filename = `detail-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const actorId = req.user?.id ?? 0;
      logger.info('Ekspor detail Excel berhasil dibuat', {
        filename,
        records: attendance.length,
        user_id: actorId,
      });

      res.send(buffer);
      return;
    } catch (error) {
      logger.error('Error ekspor Excel detail', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengekspor detail absensi ke Excel', 500);
    }
  }

  /**
   * Mengekspor rekapitulasi kehadiran pegawai ke format dokumen PDF (Dilengkapi Kop Surat Resmi).
   * GET /api/export/pdf?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToPDF(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Tanggal mulai/selesai ATAU bulan/tahun harus diisi', 400);
      }

      // Query data absensi
      let sql = `
        SELECT a.tanggal, a.user_id, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;

      const params: any[] = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || user_id) {
        sql += ' AND a.user_id = ?';
        params.push(id || user_id);
      }

      sql += ' GROUP BY a.tanggal, a.user_id, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await prisma.$queryRawUnsafe<RawAttendanceRecord[]>(sql, ...params);

      if (attendance.length === 0) {
        return errorResponse(res, 'Data tidak ditemukan untuk diekspor', 404);
      }

      const activeEmployees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, jabatan: true },
      });
      const employeeMap = new Map(activeEmployees.map((e) => [e.user_id, e]));
      const mappedAttendance = attendance.map((a) => {
        const emp = a.user_id ? employeeMap.get(a.user_id) : null;
        return {
          ...a,
          nama: emp?.nama ?? a.nama,
          jabatan: emp?.jabatan ?? a.jabatan,
        };
      });

      // Get holidays
      const holidayWhere: any = {};
      const startLocalDate = startDate ? new Date(startDate) : null;
      const endLocalDate = endDate ? new Date(endDate) : null;
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }
      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      const holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })
      );

      const totalWorkingDays = await calculateWorkingDays(startDate, endDate);

      // Transformasi data absensi
      let transformedData: any[];
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      } else {
        transformedData = transformKaryawanAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      }

      // Membuat dokumen PDF baru ukuran A4 Portrait, margin 35pt
      const doc = new PDFDocument({ margin: 35, size: 'A4' });

      // Mengatur header download HTTP response
      const filename = `rekap-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Mengalirkan langsung output PDF ke HTTP Response stream
      doc.pipe(res);

      // Cek ketersediaan file logo Politeknik Baja Tegal
      const logoPath = path.resolve('public/logo-pbjt.png');
      const hasLogo = fs.existsSync(logoPath);

      const logoStartY = 40;
      const logoWidth = 68;
      if (hasLogo) {
        doc.image(logoPath, 65, logoStartY, { width: logoWidth }); // Render logo
      }

      // Membuat teks KOP SURAT
      const textX = hasLogo ? 70 : 35;
      const textWidth = hasLogo ? 490 : 525;
      const textStartY = 51;

      doc
        .fontSize(11.5)
        .fillColor('#334155')
        .font('Helvetica-Bold')
        .text('YAYASAN PENDIDIKAN BHAKTI PRAJA TEGAL', textX, textStartY, {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(15.5)
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .text('POLITEKNIK BAJA TEGAL', {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(8.0)
        .fillColor('#475569')
        .font('Helvetica')
        .text('Jl. Raya Slawi - Jatibarang Km. 4 Dukuhwaru, Kab. Tegal, Jawa Tengah 52472', {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(8.0)
        .fillColor('#475569')
        .font('Helvetica')
        .text('Telp: (0283) 6196309 / 082325580008 | Website: www.pbjt.ac.id | Email: info@pbjt.ac.id', {
          width: textWidth,
          align: 'center',
        });

      // Menentukan posisi garis pemisah kop surat
      const logoBottomY = logoStartY + logoWidth;
      const separatorY = Math.max(doc.y, logoBottomY) + 8;

      // Menggambar garis ganda khas Kop Surat (tebal & tipis)
      doc
        .strokeColor('#0F172A')
        .lineWidth(2.2)
        .moveTo(35, separatorY)
        .lineTo(560, separatorY)
        .stroke();
      doc
        .strokeColor('#0F172A')
        .lineWidth(0.8)
        .moveTo(35, separatorY + 3)
        .lineTo(560, separatorY + 3)
        .stroke();

      doc.y = separatorY + 8;

      // Judul Laporan PDF
      let jabatanLabel = 'SEMUA PEGAWAI';
      if (jabatan === 'DOSEN') jabatanLabel = 'DOSEN';
      if (jabatan === 'KARYAWAN') jabatanLabel = 'KARYAWAN / STAFF';

      doc
        .fontSize(12)
        .fillColor('#1E293B')
        .font('Helvetica-Bold')
        .text(`LAPORAN REKAP KEHADIRAN ${jabatanLabel.toUpperCase()}`, { align: 'center' });
      doc.moveDown(0.1);

      doc
        .fontSize(8.5)
        .fillColor('#64748B')
        .font('Helvetica-Oblique')
        .text(`Periode: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`, {
          align: 'center',
        });
      doc.moveDown(0.8);

      const tableTop = doc.y;
      const startX = 35; 

      // Pengaturan lebar kolom tabel laporan rekap — kolom Terlambat hanya untuk Dosen
      const isDosenPdf = jabatan === 'DOSEN';
      const colWidths = isDosenPdf
        ? [30, 180, 65, 55, 65, 65, 65]
        : [30, 210, 75, 65, 75, 70];  // Tanpa kolom Terlambat untuk Karyawan
      const headers = isDosenPdf
        ? ['No', 'Nama', 'Hari Kerja\nTarget', 'Hadir', 'Terlambat', 'Tidak\nHadir', 'Persentase']
        : ['No', 'Nama', 'Hari Kerja\nTarget', 'Hadir', 'Tidak\nHadir', 'Persentase'];

      const rowHeight = 25;
      const headerHeight = 35;

      // Fungsi untuk menggambar Header Tabel
      const drawTableHeader = (startY: number) => {
        let xPos = startX;
        doc.fontSize(10).fillColor('#334155').font('Helvetica-Bold');
        const lineH = doc.currentLineHeight();

        headers.forEach((header, i) => {
          const w = colWidths[i] || 50;

          // Menggambar kotak sel abu-abu muda dengan garis tepi
          doc.rect(xPos, startY, w, headerHeight).fillAndStroke('#F1F5F9', '#CBD5E1');

          // Menyelaraskan teks secara vertikal di tengah sel
          const lines = header.split('\n');
          const textBlockHeight = lines.length * lineH;
          const textY = startY + (headerHeight - textBlockHeight) / 2;

          doc.fillColor('#334155').text(header, xPos + 4, textY, {
            width: w - 8,
            align: 'center',
            lineBreak: true,
          });
          xPos += w;
        });
      };

      drawTableHeader(tableTop); // Gambar header awal

      doc.font('Helvetica').fontSize(10);
      const dataLineH = doc.currentLineHeight();
      let yPos = tableTop + headerHeight;

      // Iterasi untuk menggambar baris data rekap pegawai
      transformedData.forEach((record, index) => {
        // Cek pengaman batas bawah halaman A4, tambah halaman baru jika melebihi batas 760pt
        if (yPos + rowHeight > 760) {
          doc.addPage();
          doc.moveDown(1.5);
          const newTableTop = 50;
          drawTableHeader(newTableTop);
          doc.font('Helvetica').fontSize(10);
          yPos = newTableTop + headerHeight;
        }

        let xPos = startX;

        const rowData = isDosenPdf
          ? [
              { text: String(index + 1) },
              { text: (record.nama || '-').replace(/_/g, ' ') },
              { text: String(record.totalHariKerja || 0) },
              { text: String(record.totalHadir || 0) },
              { text: String(record.totalTerlambat || 0), isLate: (record.totalTerlambat || 0) > 0 },
              { text: String(record.tidakHadir || 0) },
              { text: `${record.persentase || 0}%` },
            ]
          : [
              { text: String(index + 1) },
              { text: (record.nama || '-').replace(/_/g, ' ') },
              { text: String(record.totalHariKerja || 0) },
              { text: String(record.totalHadir || 0) },
              { text: String(record.tidakHadir || 0) },
              { text: `${record.persentase || 0}%` },
            ];

        // Zebra striping baris tabel (selang-seling warna putih dan abu-abu tipis)
        const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

        rowData.forEach((cell, i) => {
          const w = colWidths[i] || 50;

          // Gambar latar belakang sel
          doc.rect(xPos, yPos, w, rowHeight).fillAndStroke(rowBg, '#E2E8F0');

          const align = i === 1 ? 'left' : 'center';
          const textY = yPos + (rowHeight - dataLineH) / 2;
          const padding = 6;

          let fillHex = '#334155';
          let fontName = 'Helvetica';
          // Tampilkan teks dengan warna MERAH tebal jika terdeteksi terlambat
          if (cell.isLate) {
            fillHex = '#EF4444';
            fontName = 'Helvetica-Bold';
          }

          doc
            .fillColor(fillHex)
            .font(fontName)
            .fontSize(10)
            .text(cell.text, xPos + padding, textY, {
              width: w - padding * 2,
              align: align,
              lineBreak: false,
              ellipsis: true,
            });

          xPos += w;
        });

        yPos += rowHeight;
      });

      // Tanda tangan di bagian kanan bawah
      const signatureHeight = 110;
      if (yPos + signatureHeight > 760) {
        doc.addPage();
        yPos = 50;
      } else {
        yPos += 20;
      }

      const monthsID = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const exportDate = new Date();
      const exportDay = String(exportDate.getDate()).padStart(2, '0');
      const exportMonth = monthsID[exportDate.getMonth()];
      const exportYear = exportDate.getFullYear();
      const dateText = `Dukuhwaru, ${exportDay} ${exportMonth} ${exportYear}`;

      const rightAlignX = 360;
      const signatureWidth = 200;

      // 1. Tanggal Ekspor
      doc
        .fontSize(10)
        .fillColor('#334155')
        .font('Helvetica')
        .text(dateText, rightAlignX, yPos, {
          width: signatureWidth,
          align: 'center',
        });

      // 2. Jabatan
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#334155')
        .text('Pimpinan,', rightAlignX, doc.y + 2, {
          width: signatureWidth,
          align: 'center',
        });

      // 3. Ruang TTD
      doc.moveDown(4.0);

      // 4. Nama (Bold, Tanda Kurung)
      const nameText = '( Aziz Azindani, M. Kom )';
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#334155')
        .text(nameText, rightAlignX, doc.y, {
          width: signatureWidth,
          align: 'center',
          underline: false,
        });

      // Menggambar garis bawah kustom dengan spasi proporsional
      const nameWidth = doc.widthOfString(nameText);
      const lineStartX = rightAlignX + (signatureWidth - nameWidth) / 2;
      const lineEndX = lineStartX + nameWidth;
      const lineY = doc.y - 1.5;

      doc
        .strokeColor('#334155')
        .lineWidth(0.8)
        .moveTo(lineStartX, lineY)
        .lineTo(lineEndX, lineY)
        .stroke();

      // Menyesuaikan posisi y sebelum mencetak NIY agar tidak bertabrakan dengan garis
      doc.y = lineY + 3.5;

      // 5. NIY
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#334155')
        .text('NIY. 850 018 701', rightAlignX, doc.y, {
          width: signatureWidth,
          align: 'center',
          underline: false,
        });

      doc.end(); // Finalisasi dan tutup dokumen PDF

      const actorId = req.user?.id ?? 0;
      logger.info('PDF rekap berhasil dibuat', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });
      return;
    } catch (error) {
      logger.error('Error saat ekspor PDF', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengekspor data rekap ke PDF', 500);
    }
  }

  /**
   * Mengekspor ringkasan rekapitulasi kehadiran ke berkas text CSV.
   * GET /api/export/csv?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToCSV(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Tanggal mulai/selesai ATAU bulan/tahun harus diisi', 400);
      }

      // Query data absensi
      let sql = `
        SELECT a.tanggal, a.user_id, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;

      const params: any[] = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || user_id) {
        sql += ' AND a.user_id = ?';
        params.push(id || user_id);
      }

      sql += ' GROUP BY a.tanggal, a.user_id, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await prisma.$queryRawUnsafe<RawAttendanceRecord[]>(sql, ...params);

      if (attendance.length === 0) {
        return errorResponse(res, 'Data tidak ditemukan untuk diekspor', 404);
      }

      const activeEmployees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, jabatan: true },
      });
      const employeeMap = new Map(activeEmployees.map((e) => [e.user_id, e]));
      const mappedAttendance = attendance.map((a) => {
        const emp = a.user_id ? employeeMap.get(a.user_id) : null;
        return {
          ...a,
          nama: emp?.nama ?? a.nama,
          jabatan: emp?.jabatan ?? a.jabatan,
        };
      });

      // Mengambil daftar libur nasional
      const holidayWhere: any = {};
      const startLocalDate = startDate ? new Date(startDate) : null;
      const endLocalDate = endDate ? new Date(endDate) : null;
      if (startLocalDate || endLocalDate) {
        holidayWhere.tanggal = {};
        if (startLocalDate) holidayWhere.tanggal.gte = startLocalDate;
        if (endLocalDate) holidayWhere.tanggal.lte = endLocalDate;
      }
      const holidays = await prisma.holidays.findMany({
        where: holidayWhere,
        select: { tanggal: true },
      });
      const holidaySet = new Set(
        holidays.map((h) => {
          const t = h.tanggal;
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })
      );

      const totalWorkingDays = await calculateWorkingDays(startDate, endDate);

      // Transformasi data
      let transformedData: any[];
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      } else {
        transformedData = transformKaryawanAttendance(
          mappedAttendance,
          startDate,
          endDate,
          totalWorkingDays,
          holidaySet
        );
      }

      // Memetakan ke bentuk struktur baris CSV — kolom Terlambat hanya untuk Dosen
      const isDosenCsv = jabatan === 'DOSEN';
      const csvData = transformedData.map((record, index) => {
        const row: Record<string, any> = {
          No: index + 1,
          Nama: record.nama || '-',
          'Hari Kerja Target': record.totalHariKerja || 0,
          Hadir: record.totalHadir || 0,
        };
        if (isDosenCsv) row['Terlambat'] = record.totalTerlambat || 0;
        row['Tidak Hadir'] = record.tidakHadir || 0;
        row['Persentase'] = `${record.persentase || 0}%`;
        return row;
      });

      const firstRecord = csvData[0];
      if (!firstRecord) {
        return errorResponse(res, 'Data tidak ditemukan untuk diekspor', 404);
      }

      // Menyusun konten CSV string
      const headers = Object.keys(firstRecord);
      const csvRows = [
        headers.join(','), // Baris header kolom
        ...csvData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row] || '';
              // Escape karakter koma (,) dan petik ganda (") agar tidak merusak formatting kolom CSV
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
      ];
      const csvContent = csvRows.join('\n');

      // Mengatur HTTP header download file
      const filename = `rekap-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');

      // Menambahkan BOM (Byte Order Mark) UTF-8 agar Microsoft Excel langsung mengenali encoding file dengan benar
      const BOM = '\uFEFF';

      const actorId = req.user?.id ?? 0;
      logger.info('CSV rekap berhasil dibuat', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });

      res.send(BOM + csvContent);
      return;
    } catch (error) {
      logger.error('Error saat ekspor CSV', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Gagal mengekspor data ke CSV', 500);
    }
  }
}
export default ExportController;
