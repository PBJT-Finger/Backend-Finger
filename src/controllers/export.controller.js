// src/controllers/export.controller.js - Export Attendance Data
const { prisma } = require('../lib/prisma');
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
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true,
              department: true,
              fakultas: true
            }
          },
          device: {
            select: {
              device_name: true,
              location: true
            }
          }
        },
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ]
      });

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for Excel
      const excelData = attendance.map(record => ({
        'Tanggal': record.tanggal.toISOString().split('T')[0],
        'NIP': record.nip,
        'Nama': record.nama,
        'Jabatan': record.jabatan,
        'Department': record.employee?.department || '-',
        'Fakultas': record.employee?.fakultas || '-',
        'Jam Masuk': record.jam_masuk ? record.jam_masuk.toISOString().split('T')[1].substring(0, 8) : '-',
        'Jam Keluar': record.jam_keluar ? record.jam_keluar.toISOString().split('T')[1].substring(0, 8) : '-',
        'Status': record.status,
        'Device': record.device?.device_name || '-',
        'Lokasi': record.device?.location || '-',
        'Keterangan': record.keterangan || '-'
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const wscols = [
        { wch: 12 }, // Tanggal
        { wch: 15 }, // NIP
        { wch: 30 }, // Nama
        { wch: 12 }, // Jabatan
        { wch: 20 }, // Department
        { wch: 20 }, // Fakultas
        { wch: 12 }, // Jam Masuk
        { wch: 12 }, // Jam Keluar
        { wch: 12 }, // Status
        { wch: 15 }, // Device
        { wch: 20 }, // Lokasi
        { wch: 30 }  // Keterangan
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

      // For now, return 501 - PDF generation needs pdfkit setup
      // This is a placeholder for full implementation
      return errorResponse(res, 'PDF export coming soon - please use Excel or CSV for now', 501);

      /* Full implementation would be:
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();
      
      // Add header
      doc.fontSize(20).text('Rekap Absensi', { align: 'center' });
      doc.fontSize(12).text(`Periode: ${start_date} - ${end_date}`, { align: 'center' });
      
      // Add table
      // ... table generation code ...
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rekap-absensi.pdf"`);
      doc.pipe(res);
      doc.end();
      */

    } catch (error) {
      logger.error('Export to PDF error', { error: error.message });
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
      const attendance = await prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              nip: true,
              nama: true,
              jabatan: true,
              department: true,
              fakultas: true
            }
          },
          device: {
            select: {
              device_name: true,
              location: true
            }
          }
        },
        orderBy: [
          { tanggal: 'desc' },
          { jam_masuk: 'asc' }
        ]
      });

      if (attendance.length === 0) {
        return errorResponse(res, 'No data found for export', 404);
      }

      // Format data for CSV
      const csvData = attendance.map(record => ({
        tanggal: record.tanggal.toISOString().split('T')[0],
        nip: record.nip,
        nama: record.nama,
        jabatan: record.jabatan,
        department: record.employee?.department || '-',
        fakultas: record.employee?.fakultas || '-',
        jam_masuk: record.jam_masuk ? record.jam_masuk.toISOString().split('T')[1].substring(0, 8) : '-',
        jam_keluar: record.jam_keluar ? record.jam_keluar.toISOString().split('T')[1].substring(0, 8) : '-',
        status: record.status,
        device: record.device?.device_name || '-',
        lokasi: record.device?.location || '-',
        keterangan: record.keterangan || '-'
      }));

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