import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Menghubungkan ke database...');
    
    // Hitung jumlah record dari tabel penting
    const totalEmployees = await prisma.employees.count();
    const totalAttendance = await prisma.attendance.count();
    const totalShifts = await prisma.shifts.count();
    const totalAdmins = await prisma.admins.count();

    console.log('\n--- Status Database (fingerprint_db) ---');
    console.log(`- Jumlah Pegawai/Karyawan : ${totalEmployees}`);
    console.log(`- Jumlah Data Absensi     : ${totalAttendance}`);
    console.log(`- Jumlah Data Shift       : ${totalShifts}`);
    console.log(`- Jumlah Admin            : ${totalAdmins}`);
    console.log('-----------------------------------');

    if (totalEmployees === 0 && totalAttendance === 0) {
      console.log('\n❌ KESIMPULAN: Database masih kosong.');
      console.log('Data dari fingerprint_db_local.sql BELUM masuk ke server MySQL Anda.');
    } else {
      console.log('\n✅ KESIMPULAN: Database sudah terisi.');
      console.log('Data dari fingerprint_db_local.sql KEMUNGKINAN BESAR SUDAH masuk ke server Anda.');
    }

  } catch (error) {
    console.error('Gagal terhubung ke database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
