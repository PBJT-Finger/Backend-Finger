import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { errorResponse } from '../utils/responseFormatter';
import logger from '../utils/logger';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import {
  extractTimeString,
  formatDateID,
  transformDosenAttendance,
  transformKaryawanAttendance,
  RawAttendanceRecord,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Transform to aggregated data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transformedData: any[];
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(attendance, startDate, endDate);
      } else {
        transformedData = transformKaryawanAttendance(attendance, startDate, endDate);
      }

      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rekap Absensi');

      // Set columns based on jabatan
      if (jabatan === 'KARYAWAN') {
        worksheet.columns = [
          { header: 'No', key: 'no', width: 6 },
          { header: 'Nama', key: 'nama', width: 25 },
          { header: 'Hadir', key: 'hadir', width: 8 },
          { header: 'Terlambat', key: 'terlambat', width: 12 },
          { header: 'Total Hari Kerja', key: 'total_hari_kerja', width: 18 },
          { header: 'Waktu Kehadiran', key: 'waktu_kehadiran', width: 25 },
          { header: 'Check In Terakhir', key: 'check_in_terakhir', width: 18 },
          { header: 'Check Out Terakhir', key: 'check_out_terakhir', width: 18 },
        ];

        transformedData.forEach((record, index) => {
          worksheet.addRow({
            no: index + 1,
            nama: record.nama || '-',
            hadir: record.totalHadir || 0,
            terlambat: record.totalTerlambat || 0,
            total_hari_kerja: record.totalHariKerja || 0,
            waktu_kehadiran: record.attendanceDates || 'Belum ada data',
            check_in_terakhir: record.lastCheckIn || 'Belum ada data',
            check_out_terakhir: record.lastCheckOut || 'Belum ada data',
          });
        });
      } else {
        // For DOSEN or all
        worksheet.columns = [
          { header: 'No', key: 'no', width: 6 },
          { header: 'Nama', key: 'nama', width: 25 },
          { header: 'ID', key: 'user_id', width: 15 },
          { header: 'Hadir', key: 'hadir', width: 8 },
          { header: 'Total Hari Kerja', key: 'total_hari_kerja', width: 18 },
          { header: 'Waktu Kehadiran', key: 'waktu_kehadiran', width: 25 },
          { header: 'Check In Terakhir', key: 'check_in_terakhir', width: 18 },
          { header: 'Check Out Terakhir', key: 'check_out_terakhir', width: 18 },
        ];

        transformedData.forEach((record, index) => {
          worksheet.addRow({
            no: index + 1,
            nama: record.nama || '-',
            user_id: record.id || record.user_id || '-',
            hadir: record.totalHadir || 0,
            total_hari_kerja: record.totalHariKerja || 0,
            waktu_kehadiran: record.attendanceDates || 'Belum ada data',
            check_in_terakhir: record.lastCheckIn || 'Belum ada data',
            check_out_terakhir: record.lastCheckOut || 'Belum ada data',
          });
        });
      }

      // Bold header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      // Generate buffer in memory
      const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;

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
      logger.error('Export to Excel summary error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Format data for Excel — per-date detail rows (Daily Log)
      const excelData = attendance.map((record) => ({
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
      const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;

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
      logger.error('Export to Excel detailed error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Transform to aggregated data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transformedData: any[];
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(attendance, startDate, endDate);
      } else {
        transformedData = transformKaryawanAttendance(attendance, startDate, endDate);
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

      // Set response headers
      const filename = `rekap-absensi-${String(jabatan || 'all')}-${startDate}-to-${endDate}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add header with better spacing
      doc.fontSize(20).font('Helvetica-Bold').text('REKAP ABSENSI KAMPUS', { align: 'center' });
      doc.moveDown(0.2);

      // Determine Jabatan label
      let jabatanLabel = 'SEMUA PEGAWAI';
      if (jabatan === 'DOSEN') jabatanLabel = 'DOSEN';
      if (jabatan === 'KARYAWAN') jabatanLabel = 'KARYAWAN';

      doc.fontSize(14).font('Helvetica-Bold').text(jabatanLabel, { align: 'center' });
      doc.moveDown(0.2);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Periode: ${formatDateID(startDate)} s/d ${formatDateID(endDate)}`, {
          align: 'center',
        });
      doc.moveDown(1.5);

      // Table header - different columns for DOSEN vs KARYAWAN
      const tableTop = doc.y;
      const startX = 30; // Reduce left margin to maximize space
      let colWidths: number[], headers: string[];

      // Adjusted widths for A4 Landscape
      if (jabatan === 'KARYAWAN') {
        colWidths = [35, 170, 60, 80, 165, 110, 110];
        headers = [
          'No',
          'Nama',
          'Hadir',
          'Total Hari\nKerja',
          'Waktu Kehadiran',
          'Check In\nTerakhir',
          'Check Out\nTerakhir',
        ];
      } else {
        colWidths = [35, 140, 110, 60, 80, 165, 100, 100];
        headers = [
          'No',
          'Nama',
          'ID',
          'Hadir',
          'Total Hari\nKerja',
          'Waktu Kehadiran',
          'Check In\nTerakhir',
          'Check Out\nTerakhir',
        ];
      }

      const rowHeight = 30;
      const headerHeight = 40;

      // Helper function to draw table header with individual cell borders
      const drawTableHeader = (startY: number) => {
        let xPos = startX;

        doc.fontSize(9).fillColor('black').font('Helvetica-Bold');
        const lineH = doc.currentLineHeight();

        headers.forEach((header, i) => {
          // Draw cell border and background
          const w = colWidths[i] || 50;
          doc.rect(xPos, startY, w, headerHeight).fillAndStroke('#f0f0f0', '#000000');

          // Count lines in header text for vertical centering
          const lines = header.split('\n');
          const textBlockHeight = lines.length * lineH;
          const textY = startY + (headerHeight - textBlockHeight) / 2;

          doc.fillColor('black').text(header, xPos + 4, textY, {
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
      doc.font('Helvetica').fontSize(9);
      const dataLineH = doc.currentLineHeight();
      let yPos = tableTop + headerHeight;

      transformedData.forEach((record, index) => {
        // Check if we need a new page
        if (yPos + rowHeight > 550) {
          doc.addPage();
          const newTableTop = 50;
          drawTableHeader(newTableTop);
          doc.font('Helvetica').fontSize(9);
          yPos = newTableTop + headerHeight;
        }

        let xPos = startX;
        let rowData: string[];

        if (jabatan === 'KARYAWAN') {
          rowData = [
            String(index + 1),
            record.nama || '-',
            String(record.totalHadir || 0),
            String(record.totalHariKerja || 0),
            record.attendanceDates || 'Belum ada data',
            record.lastCheckIn || 'Belum ada data',
            record.lastCheckOut || 'Belum ada data',
          ];
        } else {
          rowData = [
            String(index + 1),
            record.nama || '-',
            record.id || record.user_id || '-',
            String(record.totalHadir || 0),
            String(record.totalHariKerja || 0),
            record.attendanceDates || 'Belum ada data',
            record.lastCheckIn || 'Belum ada data',
            record.lastCheckOut || 'Belum ada data',
          ];
        }

        // Draw each cell with individual borders
        rowData.forEach((data, i) => {
          const w = colWidths[i] || 50;
          doc.rect(xPos, yPos, w, rowHeight).stroke('#000000');

          const align = i === 1 ? 'left' : 'center';
          const textY = yPos + (rowHeight - dataLineH) / 2;
          const padding = 6;

          doc
            .fillColor('black')
            .fontSize(9)
            .text(data, xPos + padding, textY, {
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
      logger.error('Export to PDF error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Format data for CSV
      const csvData = attendance.map((record) => {
        return {
          tanggal: formatDateID(record.tanggal),
          id: record.user_id || '',
          nama: record.nama || '',
          jam_masuk: formatTimeFixed(record.jam_masuk),
          jam_keluar: formatTimeFixed(record.jam_keluar),
          status: record.status || '',
        };
      });

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
        records: attendance.length,
        user_id: actorId,
      });

      res.send(BOM + csvContent);
      return;
    } catch (error) {
      logger.error('Export to CSV error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      return errorResponse(res, 'Failed to export to CSV', 500);
    }
  }
}
export default ExportController;
