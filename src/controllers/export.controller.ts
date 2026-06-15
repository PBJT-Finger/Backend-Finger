import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

import {
  extractTimeString,
  formatDateID,
  transformDosenAttendance,
  transformKaryawanAttendance,
  RawAttendanceRecord,
  calculateWorkingDays,
} from '../utils/attendanceTransformer';

// Helper wrapper to handle time formatting safely
const formatTimeFixed = (timeVal: string | Date | null): string => {
  if (!timeVal) return '-';
  return extractTimeString(timeVal) || '-';
};

export class ExportController {
  /**
   * Export attendance summary to Excel
   * GET /api/export/excel?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToExcel(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
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
        return errorResponse(res, 'No data found for export', 404);
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

      // Get holidays in the selected range
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

      // Transform to aggregated data

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

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Absensi');

      // Set columns
      worksheet.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Nama', key: 'nama', width: 28 },
        { header: 'Hari Kerja Target', key: 'total_hari_kerja', width: 18 },
        { header: 'Hadir', key: 'hadir', width: 10 },
        { header: 'Terlambat', key: 'terlambat', width: 12 },
        { header: 'Tidak Hadir', key: 'tidak_hadir', width: 12 },
        { header: 'Persentase', key: 'persentase', width: 12 },
      ];

      transformedData.forEach((record, index) => {
        worksheet.addRow({
          no: index + 1,
          nama: record.nama || '-',
          total_hari_kerja: record.totalHariKerja || 0,
          hadir: record.totalHadir || 0,
          terlambat: record.totalTerlambat || 0,
          tidak_hadir: record.tidakHadir || 0,
          persentase: `${record.persentase || 0}%`,
        });
      });

      // Bold header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Generate buffer in memory
      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

      // Set headers for file download
      const filename = `rekap-absensi-summary-${String(jabatan || 'all')}-${startDate}-to-${endDate}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const actorId = req.user?.id ?? 0;
      logger.info('Excel summary export generated', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });

      res.send(buffer);
      return;
    } catch (error) {
      logger.error('Export to Excel summary error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Failed to export to Excel summary', 500);
    }
  }

  /**
   * Export detailed daily attendance to Excel
   * GET /api/export/excel-detail?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToExcelDetail(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
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
        return errorResponse(res, 'No data found for export', 404);
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

      // Format data for Excel — per-date detail rows (Daily Log)
      const excelData = mappedAttendance.map((record) => ({
        Tanggal: formatDateID(record.tanggal),
        ID: record.user_id || '',
        Nama: record.nama || '',
        'Jam Masuk': formatTimeFixed(record.jam_masuk),
        'Jam Keluar': formatTimeFixed(record.jam_keluar),
        Status: record.status || '',
      }));

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Detail Absensi');

      // Set columns with headers and widths
      worksheet.columns = [
        { header: 'Tanggal', key: 'Tanggal', width: 15 },
        { header: 'ID', key: 'ID', width: 15 },
        { header: 'Nama', key: 'Nama', width: 25 },
        { header: 'Jam Masuk', key: 'Jam Masuk', width: 14 },
        { header: 'Jam Keluar', key: 'Jam Keluar', width: 14 },
        { header: 'Status', key: 'Status', width: 12 },
      ];

      // Bold header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Add data rows
      excelData.forEach((row) => worksheet.addRow(row));

      // Generate buffer in memory
      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

      // Set headers for file download
      const filename = `detail-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      const actorId = req.user?.id ?? 0;
      logger.info('Excel detailed export generated', {
        filename,
        records: attendance.length,
        user_id: actorId,
      });

      res.send(buffer);
      return;
    } catch (error) {
      logger.error('Export to Excel detailed error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Failed to export to Excel detailed', 500);
    }
  }

  /**
   * Export attendance to PDF
   * GET /api/export/pdf?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToPDF(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
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
        return errorResponse(res, 'No data found for export', 404);
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

      // Get holidays in the selected range
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

      // Transform to aggregated data

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

      // Create PDF document (Portrait A4 with 35pt margins for neat compact fit)
      const doc = new PDFDocument({ margin: 35, size: 'A4' });

      // Set response headers
      const filename = `rekap-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Check if logo exists
      const logoPath = path.resolve('public/logo-pbjt.png');
      const hasLogo = fs.existsSync(logoPath);

      const startY = 35;
      if (hasLogo) {
        // Render logo (shifted to the right slightly)
        doc.image(logoPath, 48, startY, { width: 50 });
      }

      // Kop Surat (Institutional Letterhead) Text
      const textX = hasLogo ? 112 : 35;
      const textWidth = hasLogo ? 448 : 525;

      doc
        .fontSize(11)
        .fillColor('#334155')
        .font('Helvetica-Bold')
        .text('YAYASAN PENDIDIKAN BHAKTI PRAJA TEGAL', textX, startY, {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(15)
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .text('POLITEKNIK BAJA TEGAL', {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(8.5)
        .fillColor('#475569')
        .font('Helvetica')
        .text('Jl. Raya Slawi - Jatibarang Km. 4 Dukuhwaru, Kab. Tegal, Jawa Tengah 52472', {
          width: textWidth,
          align: 'center',
        });

      doc
        .fontSize(8.5)
        .fillColor('#475569')
        .font('Helvetica')
        .text('Telp: (0283) 6196309 / 082325580008 | Website: www.pbjt.ac.id | Email: info@pbjt.ac.id', {
          width: textWidth,
          align: 'center',
        });

      // Position below the Kop Surat texts (taking whichever is lower: doc.y or logo bottom)
      const logoBottomY = startY + 50;
      const separatorY = Math.max(doc.y, logoBottomY) + 8;

      // Draw Double Line Separator (Thick & Thin)
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

      // Report Title (Below the line)
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

      const colWidths = [30, 180, 65, 55, 65, 65, 65];
      const headers = [
        'No',
        'Nama',
        'Hari Kerja\nTarget',
        'Hadir',
        'Terlambat',
        'Tidak\nHadir',
        'Persentase',
      ];

      const rowHeight = 25;
      const headerHeight = 35;

      const drawTableHeader = (startY: number) => {
        let xPos = startX;
        doc.fontSize(10).fillColor('#334155').font('Helvetica-Bold');
        const lineH = doc.currentLineHeight();

        headers.forEach((header, i) => {
          const w = colWidths[i] || 50;

          // Draw header cell background (Light grey with grey border)
          doc.rect(xPos, startY, w, headerHeight).fillAndStroke('#F1F5F9', '#CBD5E1');

          // Vertically center text
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

      // Draw initial header
      drawTableHeader(tableTop);

      // Draw data rows
      doc.font('Helvetica').fontSize(10);
      const dataLineH = doc.currentLineHeight();
      let yPos = tableTop + headerHeight;

      transformedData.forEach((record, index) => {
        // Check if we need a new page
        if (yPos + rowHeight > 760) {
          doc.addPage();
          doc.moveDown(1.5);
          const newTableTop = 50;
          drawTableHeader(newTableTop);
          doc.font('Helvetica').fontSize(10);
          yPos = newTableTop + headerHeight;
        }

        let xPos = startX;

        const rowData = [
          { text: String(index + 1) },
          { text: (record.nama || '-').replace(/_/g, ' ') },
          { text: String(record.totalHariKerja || 0) },
          { text: String(record.totalHadir || 0) },
          { text: String(record.totalTerlambat || 0), isLate: (record.totalTerlambat || 0) > 0 },
          { text: String(record.tidakHadir || 0) },
          { text: `${record.persentase || 0}%` },
        ];

        // Alternate background colors (Zebra Striping)
        const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';

        rowData.forEach((cell, i) => {
          const w = colWidths[i] || 50;

          // Draw cell background and light grey border
          doc.rect(xPos, yPos, w, rowHeight).fillAndStroke(rowBg, '#E2E8F0');

          const align = i === 1 ? 'left' : 'center';
          const textY = yPos + (rowHeight - dataLineH) / 2;
          const padding = 6;

          let fillHex = '#334155';
          let fontName = 'Helvetica';
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

      // Finalize PDF
      doc.end();

      const actorId = req.user?.id ?? 0;
      logger.info('PDF export generated', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });
      return;
    } catch (error) {
      logger.error('Export to PDF error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Failed to export to PDF', 500);
    }
  }

  /**
   * Export attendance to CSV
   * GET /api/export/csv?start_date=X&end_date=Y&jabatan=Z&user_id=W
   */
  public static async exportToCSV(req: Request, res: Response): Promise<Response | void> {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, user_id, id } = req.query;

      let startDate = typeof start_date === 'string' ? start_date : '';
      let endDate = typeof end_date === 'string' ? end_date : '';

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan as string);
        const year = parseInt(tahun as string);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0] as string;

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0] as string;
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
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
        return errorResponse(res, 'No data found for export', 404);
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

      // Format data for CSV
      // Get holidays in the selected range
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

      // Transform to aggregated data

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

      // Format data for CSV
      const csvData = transformedData.map((record, index) => ({
        No: index + 1,
        Nama: record.nama || '-',
        'Hari Kerja Target': record.totalHariKerja || 0,
        Hadir: record.totalHadir || 0,
        Terlambat: record.totalTerlambat || 0,
        'Tidak Hadir': record.tidakHadir || 0,
        Persentase: `${record.persentase || 0}%`,
      }));

      const firstRecord = csvData[0];
      if (!firstRecord) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Create CSV string
      const headers = Object.keys(firstRecord);
      const csvRows = [
        headers.join(','),
        ...csvData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row] || '';
              // Escape commas and quotes
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
      ];
      const csvContent = csvRows.join('\n');

      // Set headers for file download
      const filename = `rekap-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');

      // Add BOM for Excel UTF-8 support
      const BOM = '\uFEFF';

      const actorId = req.user?.id ?? 0;
      logger.info('CSV export generated', {
        filename,
        records: transformedData.length,
        user_id: actorId,
      });

      res.send(BOM + csvContent);
      return;
    } catch (error) {
      logger.error('Export to CSV error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return errorResponse(res, 'Failed to export to CSV', 500);
    }
  }
}
export default ExportController;
