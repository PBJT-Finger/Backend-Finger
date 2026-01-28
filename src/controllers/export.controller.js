// src/controllers/export.controller.js - Export Attendance Data (Prisma)
const { prisma } = require('../models');
const { formatTime } = require('../utils/prismaHelpers');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');
const XLSX = require('xlsx');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

class ExportController {
  /**
   * Export attendance to Excel
   * GET /api/export/excel?start_date=X&end_date=Y&jabatan=Z&nip=W
   */
  static async exportToExcel(req, res) {
    try {
      const { start_date, end_date, jabatan, nip } = req.query;

      // Helper function to format time (handles both string and Date object)
      const formatTime = (timeValue) => {
        if (!timeValue) return '-';
        if (typeof timeValue === 'string') return timeValue;
        if (timeValue instanceof Date) return timeValue.toISOString().split('T')[1].substring(0, 8);
        return String(timeValue);
      };

      if (!start_date || !end_date) {
        return errorResponse(res, 'start_date and end_date are required', 400);
      }

      // Build where clause
      const where = {
        tanggal: {
          gte: new Date(start_date),
          lte: new Date(end_date)
        },
        is_deleted: false
      };

      if (jabatan) where.jabatan = jabatan;
      if (nip) where.nip = nip;

      // Get attendance data
      let sql = `
        SELECT a.* 
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [new Date(start_date), new Date(end_date)];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (nip) {
        sql += ' AND a.nip = ?';
        params.push(nip);
      }

      sql += ' ORDER BY a.tanggal DESC, a.jam_masuk ASC';

      const attendance = await query(sql, params);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for Excel
      const excelData = attendance.map(record => {
        // For KARYAWAN, exclude NIP and Jabatan columns
        if (jabatan === 'KARYAWAN') {
          return {
            'Tanggal': record.tanggal.toISOString().split('T')[0],
            'Nama': record.nama,
            'Jam Masuk': formatTime(record.jam_masuk),
            'Jam Keluar': formatTime(record.jam_keluar),
            'Status': record.status,
            'Device': record.device_id || '-'
          };
        } else {
          // For DOSEN, include all columns
          return {
            'Tanggal': record.tanggal.toISOString().split('T')[0],
            'NIP': record.nip,
            'Nama': record.nama,
            'Jabatan': record.jabatan,
            'Jam Masuk': formatTime(record.jam_masuk),
            'Jam Keluar': formatTime(record.jam_keluar),
            'Status': record.status,
            'Device': record.device_id || '-'
          };
        }
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const wscols = [
        { wch: 12 }, // Tanggal
        { wch: 15 }, // NIP
        { wch: 30 }, // Nama
        { wch: 12 }, // Jabatan
        { wch: 12 }, // Jam Masuk
        { wch: 12 }, // Jam Keluar
        { wch: 12 }, // Status
        { wch: 15 }  // Device
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

      // Add summary sheet
      const summaryData = [{
        'Total Records': attendance.length,
        'Period': `${start_date} to ${end_date}`,
        'Jabatan Filter': jabatan || 'All',
        'Unique Employees': new Set(attendance.map(a => a.nip)).size,
        'Total Hadir': attendance.filter(a => a.jam_masuk !== null).length,
        'Total Terlambat': attendance.filter(a => a.status === 'TERLAMBAT').length
      }];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Generate buffer
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      const filename = `rekap-absensi-${jabatan || 'all'}-${start_date}-to-${end_date}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      logger.info('Excel export generated', {
        filename,
        records: attendance.length,
        user_id: req.user?.id
      });

      return res.send(buf);

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
      const { start_date, end_date, jabatan, nip } = req.query;

      if (!start_date || !end_date) {
        return errorResponse(res, 'start_date and end_date are required', 400);
      }

      // Helper function to format date to DD/MM/YYYY
      const formatDateID = (dateStr) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const PDFDocument = require('pdfkit');
      const { transformDosenAttendance, transformKaryawanAttendance } = require('../utils/attendanceTransformer');

      // Get attendance data
      let sql = `
        SELECT a.* 
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [new Date(start_date), new Date(end_date)];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (nip) {
        sql += ' AND a.nip = ?';
        params.push(nip);
      }

      sql += ' ORDER BY a.tanggal DESC, a.jam_masuk ASC';

      const attendance = await query(sql, params);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Transform to aggregated data (same as dashboard)
      let transformedData;
      if (jabatan === 'DOSEN') {
        transformedData = transformDosenAttendance(attendance);
      } else if (jabatan === 'KARYAWAN') {
        transformedData = transformKaryawanAttendance(attendance);
      } else {
        // If no jabatan specified, we cannot use transformer
        return errorResponse(res, 'jabatan parameter is required for PDF export', 400);
      }

      // Create PDF document - use landscape for better fit with improved margins
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

      // Set response headers
      const filename = `rekap-absensi-${jabatan || 'all'}-${start_date}-to-${end_date}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add header with better spacing
      doc.fontSize(20).font('Helvetica-Bold').text('REKAP ABSENSI KAMPUS', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica').text(`Periode: ${formatDateID(start_date)} s/d ${formatDateID(end_date)}`, { align: 'center' });
      doc.text(`Jabatan: ${jabatan}`, { align: 'center' });
      doc.moveDown(1.5);

      // Table header - different columns for DOSEN vs KARYAWAN
      const tableTop = doc.y;
      const startX = 50; // Start from left margin
      let colWidths, headers;

      if (jabatan === 'KARYAWAN') {
        // KARYAWAN: No, Nama, Hadir, Terlambat, Total Hari Kerja, Waktu Kehadiran, Check In, Check Out
        // Adjusted widths: removed 'Tidak Hadir' column
        colWidths = [35, 150, 50, 60, 70, 145, 90, 90];
        headers = ['No', 'Nama', 'Hadir', 'Terlambat', 'Total Hari\nKerja', 'Waktu Kehadiran', 'Check In\nTerakhir', 'Check Out\nTerakhir'];
      } else {
        // DOSEN: No, Nama, NIP, Hadir, Total Hari Kerja, Waktu Kehadiran, Check In, Check Out
        // Removed 'Tidak Hadir' column, redistributed width
        colWidths = [35, 120, 100, 50, 70, 145, 90, 90];
        headers = ['No', 'Nama', 'NIP', 'Hadir', 'Total Hari\nKerja', 'Waktu Kehadiran', 'Check In\nTerakhir', 'Check Out\nTerakhir'];
      }

      const rowHeight = 25;
      const headerHeight = 30;

      // Helper function to draw table header with individual cell borders
      const drawTableHeader = (startY) => {
        let xPos = startX;

        doc.fontSize(9).fillColor('black').font('Helvetica-Bold');
        headers.forEach((header, i) => {
          // Draw cell border and background
          doc.rect(xPos, startY, colWidths[i], headerHeight).fillAndStroke('#f0f0f0', '#000000');

          // Draw text centered vertically and horizontally
          const textY = startY + 8;
          doc.fillColor('black').text(header, xPos + 2, textY, {
            width: colWidths[i] - 4,
            align: 'center',
            lineBreak: false
          });
          xPos += colWidths[i];
        });
      };

      // Draw initial header
      drawTableHeader(tableTop);

      // Draw data rows
      doc.font('Helvetica');
      let yPos = tableTop + headerHeight;

      transformedData.forEach((record, index) => {
        // Check if we need a new page (adjusted for new margins)
        if (yPos + rowHeight > 550) {
          doc.addPage();
          const newTableTop = 50;
          drawTableHeader(newTableTop);
          doc.font('Helvetica');
          yPos = newTableTop + headerHeight;
        }

        let xPos = startX;
        let rowData;

        if (jabatan === 'KARYAWAN') {
          // KARYAWAN data without 'Tidak Hadir'
          rowData = [
            String(index + 1),
            record.nama || '-',
            String(record.totalHadir || 0),
            String(record.totalTerlambat || 0),
            String(record.totalHariKerja || 0),
            record.attendanceDates || 'Belum ada data',
            record.lastCheckIn || 'Belum ada data',
            record.lastCheckOut || 'Belum ada data'
          ];
        } else {
          // DOSEN data without 'Tidak Hadir'
          rowData = [
            String(index + 1),
            record.nama || '-',
            record.nip || '-',
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

          // Calculate vertical center for text (center text in cell)
          const textY = yPos + (rowHeight - 8) / 2;
          const padding = 4;

          doc.fillColor('black').fontSize(8).text(data, xPos + padding, textY, {
            width: colWidths[i] - (padding * 2),
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
      const { start_date, end_date, jabatan, nip } = req.query;

      // Helper function to format time (handles both string and Date object)
      const formatTime = (timeValue) => {
        if (!timeValue) return '-';
        if (typeof timeValue === 'string') return timeValue;
        if (timeValue instanceof Date) return timeValue.toISOString().split('T')[1].substring(0, 8);
        return String(timeValue);
      };

      if (!start_date || !end_date) {
        return errorResponse(res, 'start_date and end_date are required', 400);
      }

      // Get attendance data
      let sql = `
        SELECT a.* 
        FROM attendance a
        WHERE a.tanggal >= ? AND a.tanggal <= ? AND a.is_deleted = 0
      `;
      const params = [new Date(start_date), new Date(end_date)];

      if (jabatan) {
        sql += ' AND a.jabatan = ?';
        params.push(jabatan);
      }

      if (nip) {
        sql += ' AND a.nip = ?';
        params.push(nip);
      }

      sql += ' ORDER BY a.tanggal DESC, a.jam_masuk ASC';

      const attendance = await query(sql, params);

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for CSV
      const csvData = attendance.map(record => {
        // For KARYAWAN, exclude NIP and Jabatan columns
        if (jabatan === 'KARYAWAN') {
          return {
            tanggal: record.tanggal.toISOString().split('T')[0],
            nama: record.nama,
            jam_masuk: formatTime(record.jam_masuk),
            jam_keluar: formatTime(record.jam_keluar),
            status: record.status,
            device: record.device_id || '-'
          };
        } else {
          // For DOSEN, include all columns
          return {
            tanggal: record.tanggal.toISOString().split('T')[0],
            nip: record.nip,
            nama: record.nama,
            jabatan: record.jabatan,
            jam_masuk: formatTime(record.jam_masuk),
            jam_keluar: formatTime(record.jam_keluar),
            status: record.status,
            device: record.device_id || '-'
          };
        }
      });

      // Create CSV string
      const headers = Object.keys(csvData[0]);
      const csvRows = [
        headers.join(','), // Header row
        ...csvData.map(row => headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(','))
      ];
      const csvContent = csvRows.join('\n');

      // Set headers for file download
      const filename = `rekap-absensi-${jabatan || 'all'}-${start_date}-to-${end_date}.csv`;
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