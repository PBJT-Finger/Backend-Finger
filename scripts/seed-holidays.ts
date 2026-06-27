/**
 * scripts/seed-holidays.ts
 *
 * Skrip utilitas CLI untuk memasukkan data hari libur nasional Indonesia tahun 2026
 * ke dalam database secara otomatis. Berguna untuk perhitungan absensi (misal: membedakan hari kerja dan libur).
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Interface tipe data untuk struktur hari libur
interface HolidayInput {
  tanggal: string; // Format tanggal YYYY-MM-DD
  nama_libur: string;
}

// Daftar Libur Nasional & Cuti Bersama Indonesia Tahun 2026
const holidays2026: HolidayInput[] = [
  { tanggal: '2026-01-01', nama_libur: 'Tahun Baru Masehi' },
  { tanggal: '2026-01-16', nama_libur: "Isra Mi'raj Nabi Muhammad S.A.W." },
  { tanggal: '2026-02-16', nama_libur: 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili' },
  { tanggal: '2026-02-17', nama_libur: 'Tahun Baru Imlek 2577 Kongzili' },
  { tanggal: '2026-03-18', nama_libur: 'Cuti Bersama Hari Suci Nyepi' },
  { tanggal: '2026-03-19', nama_libur: 'Hari Suci Nyepi (Tahun Baru Saka 1948)' },
  { tanggal: '2026-03-20', nama_libur: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-03-21', nama_libur: 'Hari Raya Idul Fitri 1447 H' },
  { tanggal: '2026-03-22', nama_libur: 'Hari Raya Idul Fitri 1447 H' },
  { tanggal: '2026-03-23', nama_libur: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-03-24', nama_libur: 'Cuti Bersama Idul Fitri 1447 H' },
  { tanggal: '2026-04-03', nama_libur: 'Wafat Yesus Kristus' },
  { tanggal: '2026-04-05', nama_libur: 'Kebangkitan Yesus Kristus (Paskah)' },
  { tanggal: '2026-05-01', nama_libur: 'Hari Buruh Internasional' },
  { tanggal: '2026-05-14', nama_libur: 'Kenaikan Yesus Kristus' },
  { tanggal: '2026-05-15', nama_libur: 'Cuti Bersama Kenaikan Yesus Kristus' },
  { tanggal: '2026-05-27', nama_libur: 'Hari Raya Idul Adha 1447 H' },
  { tanggal: '2026-05-28', nama_libur: 'Cuti Bersama Hari Raya Idul Adha 1447 H' },
  { tanggal: '2026-05-31', nama_libur: 'Hari Raya Waisak 2570 BE' },
  { tanggal: '2026-06-01', nama_libur: 'Hari Lahir Pancasila' },
  { tanggal: '2026-06-16', nama_libur: 'Tahun Baru Islam 1448 H' },
  { tanggal: '2026-08-17', nama_libur: 'Hari Kemerdekaan Proklamasi RI' },
  { tanggal: '2026-08-25', nama_libur: 'Maulid Nabi Muhammad S.A.W.' },
  { tanggal: '2026-12-24', nama_libur: 'Cuti Bersama Hari Raya Natal' },
  { tanggal: '2026-12-25', nama_libur: 'Hari Raya Natal' },
];

async function main() {
  console.log('[INFO] Memulai proses seeding data Hari Libur Nasional 2026...');

  for (const h of holidays2026) {
    const tanggalDate = new Date(h.tanggal);
    // Menggunakan operasi upsert untuk menghindari duplikasi kunci primer jika data sudah ada
    await prisma.holidays.upsert({
      where: { tanggal: tanggalDate },
      update: { nama_libur: h.nama_libur },
      create: {
        tanggal: tanggalDate,
        nama_libur: h.nama_libur,
      },
    });
  }

  // Menghitung jumlah total data hari libur yang terdaftar
  const count = await prisma.holidays.count();
  console.log(`[SUCCESS] Seeding selesai. Total data hari libur di database: ${count}`);
}

// Eksekusi fungsi utama dan penanganan pemutusan koneksi client database
main()
  .catch((e) => {
    console.error('[ERROR] Terjadi kesalahan saat seeding hari libur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
