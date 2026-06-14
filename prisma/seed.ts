import {
  PrismaClient,
  employees_jabatan,
  attendance_jabatan,
  employees_status,
} from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting unified database seed...');

  // 1. Create Shift
  const shift = await prisma.shifts.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nama_shift: 'Shift Regular Karyawan',
      jam_masuk: new Date('1970-01-01T08:00:00Z'),
      jam_keluar: new Date('1970-01-01T16:00:00Z'),
      deskripsi: 'Standard office shift for karyawan',
      is_active: true,
    },
  });
  console.log(`Upserted shift: ${shift.nama_shift}`);

  // 2. Create Device
  const device = await prisma.devices.upsert({
    where: { device_id: 'FP-GEDUNG-A-001' },
    update: {
      ip_address: '175.17.5.50',
    },
    create: {
      device_id: 'FP-GEDUNG-A-001',
      device_name: 'ADMS Fingerprint - Gedung A Lantai 1',
      ip_address: '175.17.5.50',
      location: 'Gedung A Lt.1 (Lobby Utama)',
      api_key_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK',
      is_active: true,
    },
  });
  console.log(`Upserted device: ${device.device_name}`);

  // 3. Import Users from Device JSON
  const jsonPath = path.join(__dirname, '../seeds/employees_from_device.json');
  let rawUsers: { userId: string; name: string }[] = [];
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    rawUsers = JSON.parse(rawData);
  } else {
    console.warn('employees_from_device.json not found. Using default mock users.');
    rawUsers = [
      { userId: '1', name: 'Melinda' },
      { userId: '2', name: 'Rafly' },
      { userId: '3', name: 'Ilham_Akhsani' },
      { userId: '4', name: 'Slamet_Riyadi' },
      { userId: '5', name: 'Lily_Budinurani' },
      { userId: '6', name: 'Ria_Candra_Dewi' },
      { userId: '7', name: 'Atiek_Nurindriani' },
    ];
  }

  const employees = [];
  for (const u of rawUsers) {
    const emp = await prisma.employees.upsert({
      where: { user_id: u.userId },
      update: {
        nama: u.name,
        is_active: true,
      },
      create: {
        user_id: u.userId,
        nama: u.name,
        jabatan: employees_jabatan.KARYAWAN,
        shift_id: shift.id,
        status: employees_status.AKTIF,
        is_active: true,
      },
    });
    employees.push(emp);
  }
  console.log(`Upserted ${employees.length} employees from device.`);

  // 4. Generate Mock Attendance for the last 30 days
  console.log('Skipping mock attendance generation for production.');
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
