// src/controllers/export.controller.js - Export Attendance Data (Prisma)
const prisma = require('../config/prisma');
// Compatibility wrapper: raw SQL queries via Prisma
const query = (sql, params = []) => prisma.$queryRawUnsafe(sql, ...params);
const { errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const XLSX = require('xlsx');

const { extractTimeString, formatDateID } = require('../utils/attendanceTransformer');

// Helper wrapper to handle time formatting safely
const formatTimeFixed = (timeVal) => {
  if (!timeVal) return '-';
  return extractTimeString(timeVal) || '-';
};

class ExportController {
  /**
   * Export attendance to Excel
   * GET /api/export/excel?start_date=X&end_date=Y&jabatan=Z&nip=W
   */
  static async exportToExcel(req, res) {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, nip, id } = req.query;

      let startDate = start_date;
      let endDate = end_date;

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan);
        const year = parseInt(tahun);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0];

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0];
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
      let sql = `
        SELECT a.tanggal, a.nip, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a

        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || nip) {
        sql += ' AND a.nip = ?';
        params.push(id || nip);
      }

      sql += ' GROUP BY a.tanggal, a.nip, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await query(sql, params);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for Excel — per-date detail rows (Daily Log)
      // Use helper to fix time format (mysql2 string vs Prisma Date issue)


      const excelData = attendance.map(record => ({
        Tanggal: formatDateID(record.tanggal), // Use DD/MM/YYYY format
        ID: record.nip,
        Nama: record.nama,
        'Jam Masuk': formatTimeFixed(record.jam_masuk),
        'Jam Keluar': formatTimeFixed(record.jam_keluar),
        Status: record.status
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const wscols = [
        { wch: 15 }, // Tanggal
        { wch: 15 }, // ID
        { wch: 25 }, // Nama
        { wch: 12 }, // Jam Masuk
        { wch: 12 }, // Jam Keluar
        { wch: 12 }  // Status
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      const filename = `rekap-absensi-${jabatan || 'all'}-${startDate}-to-${endDate}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      logger.info('Excel export generated', {
        filename,
        records: attendance.length,
        user_id: req.user?.id
      });

      return res.send(buffer);
    } catch (error) {
      logger.error('Export to Excel error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to export to Excel', 500);
    }
  }

  /**
   * Export attendance to PDF
   * GET /api/export/pdf?start_date=X&end_date=Y&jabatan=Z&nip=W
   */
  static async exportToPDF(req, res) {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, nip, id } = req.query;

      let startDate = start_date;
      let endDate = end_date;

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan);
        const year = parseInt(tahun);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0];

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0];
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Helper function to format date to DD/MM/YYYY
      const formatDateID = dateStr => {
        if (!dateStr) return '-';
        if (typeof dateStr === 'string') {
          const datePart = dateStr.split('T')[0];
          const parts = datePart.split('-');
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const PDFDocument = require('pdfkit');
      const {
        transformDosenAttendance,
        transformKaryawanAttendance
      } = require('../utils/attendanceTransformer');

      // Get attendance data — deduplicate: one row per employee per date
      let sql = `
        SELECT a.tanggal, a.nip, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a

        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || nip) {
        sql += ' AND a.nip = ?';
        params.push(id || nip);
      }

      sql += ' GROUP BY a.tanggal, a.nip, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      console.log(`[ExportPDF] Query Params: startDate=${startDate}, endDate=${endDate}, jabatan=${jabatan}`);

      const attendance = await query(sql, params);
      console.log(`[ExportPDF] Found ${attendance.length} attendance records`);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Transform to aggregated data (same as dashboard)
      let transformedData;
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(attendance, startDate, endDate);
      } else if (jabatan === 'KARYAWAN') {
        transformedData = transformKaryawanAttendance(attendance, startDate, endDate);
      } else {
        // No jabatan filter - use karyawan transformer as unified format
        transformedData = transformKaryawanAttendance(attendance, startDate, endDate);
      }

      console.log(`[ExportPDF] Transformed ${transformedData.length} records for PDF`);

      // Create PDF document - use landscape for better fit with improved margins
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

      // Set response headers

      const filename = `rekap-absensi-${jabatan || 'all'}-${startDate}-to-${endDate}.pdf`;
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
          align: 'center'
        });
      doc.moveDown(1.5);

      // Table header - different columns for DOSEN vs KARYAWAN
      const tableTop = doc.y;
      const startX = 30; // Reduce left margin to maximize space
      let colWidths, headers;

      // Adjusted widths for A4 Landscape (Total width approx 780px)
      if (jabatan === 'KARYAWAN') {
        // KARYAWAN: No, Nama, Hadir, Total Hari Kerja, Waktu Kehadiran, Check In, Check Out
        colWidths = [35, 170, 60, 80, 165, 110, 110];
        headers = [
          'No',
          'Nama',
          'Hadir',
          'Total Hari\nKerja',
          'Waktu Kehadiran',
          'Check In\nTerakhir',
          'Check Out\nTerakhir'
        ];
      } else {
        // DOSEN or ALL: No, Nama, ID, Hadir, Total Hari Kerja, Waktu Kehadiran, Check In, Check Out
        colWidths = [35, 140, 110, 60, 80, 165, 100, 100];
        headers = [
          'No',
          'Nama',
          'ID', // Renamed from NIP
          'Hadir',
          'Total Hari\nKerja',
          'Waktu Kehadiran',
          'Check In\nTerakhir',
          'Check Out\nTerakhir'
        ];
      }

      const rowHeight = 30;
      const headerHeight = 40;

      // Helper function to draw table header with individual cell borders
      const drawTableHeader = startY => {
        let xPos = startX;

        doc.fontSize(9).fillColor('black').font('Helvetica-Bold');
        const lineH = doc.currentLineHeight();

        headers.forEach((header, i) => {
          // Draw cell border and background
          doc.rect(xPos, startY, colWidths[i], headerHeight).fillAndStroke('#f0f0f0', '#000000');

          // Count lines in header text for vertical centering
          const lines = header.split('\n');
          const textBlockHeight = lines.length * lineH;
          const textY = startY + (headerHeight - textBlockHeight) / 2;

          doc.fillColor('black').text(header, xPos + 4, textY, {
            width: colWidths[i] - 8,
            align: 'center',
            lineBreak: true
          });
          xPos += colWidths[i];
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
        let rowData;

        if (jabatan === 'KARYAWAN') {
          // KARYAWAN data
          rowData = [
            String(index + 1),
            record.nama || '-',
            String(record.totalHadir || 0),
            String(record.totalHariKerja || 0),
            record.attendanceDates || 'Belum ada data',
            record.lastCheckIn || 'Belum ada data',
            record.lastCheckOut || 'Belum ada data'
          ];
        } else {
          // DOSEN or ALL data with NIP
          rowData = [
            String(index + 1),
            record.nama || '-',
            record.id || record.nip || '-', // Prioritize ID
            String(record.totalHadir || 0),
            String(record.totalHariKerja || 0),
            record.attendanceDates || 'Belum ada data',
            record.lastCheckIn || 'Belum ada data',
            record.lastCheckOut || 'Belum ada data'
          ];
        }

        // Draw each cell with individual borders
        rowData.forEach((data, i) => {
          // Draw cell border
          doc.rect(xPos, yPos, colWidths[i], rowHeight).stroke('#000000');

          // Determine alignment: left for Nama only, center for all other columns
          const align = i === 1 ? 'left' : 'center';

          // Calculate vertical center for text
          const textY = yPos + (rowHeight - dataLineH) / 2;
          const padding = 6;

          doc
            .fillColor('black')
            .fontSize(9)
            .text(data, xPos + padding, textY, {
              width: colWidths[i] - padding * 2,
              align: align,
              lineBreak: false,
              ellipsis: true
            });

          xPos += colWidths[i];
        });

        yPos += rowHeight;
      });

      // Finalize PDF
      doc.end();

      logger.info('PDF export generated', {
        filename,
        records: transformedData.length,
        user_id: req.user?.id
      });
    } catch (error) {
      logger.error('Export to PDF error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to export to PDF', 500);
    }
  }

  /**
   * Export attendance to CSV
   * GET /api/export/csv?start_date=X&end_date=Y&jabatan=Z&nip=W
   */
  static async exportToCSV(req, res) {
    try {
      const { start_date, end_date, bulan, tahun, jabatan, nip, id } = req.query;

      let startDate = start_date;
      let endDate = end_date;

      // Handle month/year to date range conversion
      if (bulan && tahun) {
        const month = parseInt(bulan);
        const year = parseInt(tahun);

        // Start date: 1st of the month
        const start = new Date(year, month - 1, 1);
        startDate = start.toISOString().split('T')[0];

        // End date: Last day of the month
        const end = new Date(year, month, 0);
        endDate = end.toISOString().split('T')[0];
      }

      if (!startDate || !endDate) {
        return errorResponse(res, 'Start date/end date OR month/year are required', 400);
      }

      // Get attendance data — deduplicate: one row per employee per date
      let sql = `
        SELECT a.tanggal, a.nip, a.nama, a.jabatan,
               MIN(a.jam_masuk) AS jam_masuk,
               MAX(a.jam_keluar) AS jam_keluar,
               MAX(a.status) AS status
        FROM attendance a

        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [startDate, endDate];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (id || nip) {
        sql += ' AND a.nip = ?';
        params.push(id || nip);
      }

      sql += ' GROUP BY a.tanggal, a.nip, a.nama, a.jabatan';
      sql += ' ORDER BY a.tanggal DESC, jam_masuk ASC';

      const attendance = await query(sql, params);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for CSV
      const csvData = attendance.map(record => {
        return {
          tanggal: formatDateID(record.tanggal),
          id: record.nip, // Rename nip to id
          nama: record.nama,
          jam_masuk: formatTimeFixed(record.jam_masuk),
          jam_keluar: formatTimeFixed(record.jam_keluar),
          status: record.status
        };
      });

      // Create CSV string
      const headers = Object.keys(csvData[0]);
      const csvRows = [
        headers.join(','), // Header row
        ...csvData.map(row =>
          headers
            .map(header => {
              const value = row[header];
              // Escape commas and quotes
              return `"${String(value).replace(/"/g, '""')}"`;
            })
            .join(',')
        )
      ];
      const csvContent = csvRows.join('\n');

      // Set headers for file download
      const filename = `rekap-absensi-${jabatan || 'all'}-${startDate}-to-${endDate}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');

      // Add BOM for Excel UTF-8 support
      const BOM = '\uFEFF';

      logger.info('CSV export generated', {
        filename,
        records: attendance.length,
        user_id: req.user?.id
      });

      return res.send(BOM + csvContent);
    } catch (error) {
      logger.error('Export to CSV error', { error: error.message, stack: error.stack });
      return errorResponse(res, 'Failed to export to CSV', 500);
    }
  }
}

module.exports = ExportController;
