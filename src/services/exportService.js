// src/services/exportService.js

const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '../../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const exportData = async (data, format, filename) => {
  const filePath = path.join(exportsDir, `${filename}.${format === 'excel' ? 'xlsx' : format}`);

  switch (format) {
    case 'excel':
      return await exportToExcel(data, filePath);
    case 'pdf':
      return await exportToPDF(data, filePath);
    case 'csv':
      return await exportToCSV(data, filePath);
    default:
      throw new Error('Unsupported format');
  }
};

const exportSummaryData = async (data, format, filename) => {
  const filePath = path.join(exportsDir, `${filename}.${format === 'excel' ? 'xlsx' : format}`);

  switch (format) {
    case 'excel':
      return await exportSummaryToExcel(data, filePath);
    case 'pdf':
      return await exportSummaryToPDF(data, filePath);
    case 'csv':
      return await exportSummaryToCSV(data, filePath);
    default:
      throw new Error('Unsupported format');
  }
};

const exportToExcel = async (data, filePath) => {
  // Transform data for Excel format
  const excelData = data.map(record => ({
    'Cloud ID': record.cloud_id,
    'Device ID': record.device_id,
    'User ID': record.user_id,
    Nama: record.nama,
    'Tanggal Absensi': record.tanggal_absensi,
    'Waktu Absensi': record.waktu_absensi,
    Verifikasi: record.verifikasi,
    'Tipe Absensi': record.tipe_absensi,
    'Tanggal Upload': record.tanggal_upload,
    'Kategori User': record.kategori_user
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Data');
  XLSX.writeFile(wb, filePath);
  return filePath;
};

const exportToPDF = async (data, filePath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text('Laporan Absensi Kampus', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Total Records: ${data.length}`, { align: 'left' });
  doc.moveDown();

  // Table headers
  const headers = ['No', 'Nama', 'User ID', 'Tanggal', 'Waktu', 'Tipe'];
  let yPosition = doc.y + 20;

  headers.forEach((header, index) => {
    doc.fontSize(10).text(header, 50 + index * 80, yPosition, { width: 70, align: 'center' });
  });

  doc.moveDown();

  // Table data
  data.forEach((record, index) => {
    if (yPosition > 700) {
      // New page if needed
      doc.addPage();
      yPosition = 50;
    }

    const rowData = [
      (index + 1).toString(),
      record.nama,
      record.user_id,
      record.tanggal_absensi,
      record.waktu_absensi,
      record.tipe_absensi
    ];

    rowData.forEach((cell, cellIndex) => {
      doc.fontSize(8).text(cell, 50 + cellIndex * 80, yPosition, { width: 70, align: 'center' });
    });

    yPosition += 15;
  });

  doc.end();
  return new Promise(resolve => {
    doc.on('end', () => resolve(filePath));
  });
};

const exportToCSV = async (data, filePath) => {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'cloud_id', title: 'Cloud ID' },
      { id: 'device_id', title: 'Device ID' },
      { id: 'user_id', title: 'User ID' },
      { id: 'nama', title: 'Nama' },
      { id: 'tanggal_absensi', title: 'Tanggal Absensi' },
      { id: 'waktu_absensi', title: 'Waktu Absensi' },
      { id: 'verifikasi', title: 'Verifikasi' },
      { id: 'tipe_absensi', title: 'Tipe Absensi' },
      { id: 'tanggal_upload', title: 'Tanggal Upload' },
      { id: 'kategori_user', title: 'Kategori User' }
    ]
  });
  await csvWriter.writeRecords(data);
  return filePath;
};

const exportSummaryToExcel = async (data, filePath) => {
  const excelData = data.map(record => ({
    No: record.no,
    Nama: record.nama,
    ID: record.nip,
    Jabatan: record.jabatan,
    Hadir: record.hadir,
    'Total Hari Kerja': record.total_hari_kerja,
    Terlambat: record.terlambat,
    Persentase: record.persentase,
    'Check In Terakhir': record.check_in_terakhir,
    'Check Out Terakhir': record.check_out_terakhir
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Data');
  XLSX.writeFile(wb, filePath);
  return filePath;
};

const exportSummaryToPDF = async (data, filePath) => {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(16).text('Rekap Absensi', { align: 'center' });
  doc.moveDown();

  data.forEach((record, index) => {
    doc.fontSize(12).text(`No: ${record.no}`);
    doc.text(`Nama: ${record.nama}`);
    doc.text(`ID: ${record.nip}`);
    doc.text(`Jabatan: ${record.jabatan}`);
    doc.text(`Hadir: ${record.hadir}`);
    doc.text(`Total Hari Kerja: ${record.total_hari_kerja}`);
    doc.text(`Terlambat: ${record.terlambat}`);
    doc.text(`Persentase: ${record.persentase}%`);
    doc.text(`Check In Terakhir: ${record.check_in_terakhir || 'N/A'}`);
    doc.text(`Check Out Terakhir: ${record.check_out_terakhir || 'N/A'}`);
    doc.moveDown();
  });

  doc.end();
  return filePath;
};

const exportSummaryToCSV = async (data, filePath) => {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'no', title: 'No' },
      { id: 'nama', title: 'Nama' },
      { id: 'nip', title: 'ID' },
      { id: 'jabatan', title: 'Jabatan' },
      { id: 'hadir', title: 'Hadir' },
      { id: 'total_hari_kerja', title: 'Total Hari Kerja' },
      { id: 'terlambat', title: 'Terlambat' },
      { id: 'persentase', title: 'Persentase' },
      { id: 'check_in_terakhir', title: 'Check In Terakhir' },
      { id: 'check_out_terakhir', title: 'Check Out Terakhir' }
    ]
  });
  await csvWriter.writeRecords(data);
  return filePath;
};

module.exports = {
  exportData,
  exportSummaryData,
  exportToExcel,
  exportToPDF,
  exportToCSV,
  exportSummaryToExcel,
  exportSummaryToPDF,
  exportSummaryToCSV
};
