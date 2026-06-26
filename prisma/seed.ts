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

  // 3. Import SQL Dump safely (DO THIS FIRST to preserve DOSEN roles)
  const sqlPath = path.join(process.cwd(), 'fingerprint_db.sql');
  if (fs.existsSync(sqlPath)) {
    console.log('Found fingerprint_db.sql. Extracting and running INSERT statements safely...');
    
    const buffer = fs.readFileSync(sqlPath);
    let sqlContent = '';
    // Check for UTF-16 LE BOM (FF FE)
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      sqlContent = buffer.toString('utf16le');
    } else {
      sqlContent = buffer.toString('utf-8');
    }
    
    // Split the file by newlines
    const lines = sqlContent.split(/\r?\n/);
    
    // Group INSERT statements by table name
    const inserts: Record<string, string[]> = {};
    for (const line of lines) {
      if (line.startsWith('INSERT INTO')) {
        const match = line.match(/INSERT INTO `([^`]+)`/);
        if (match && match[1]) {
          const tableName = match[1];
          let tableInserts = inserts[tableName];
          if (!tableInserts) {
            tableInserts = [];
            inserts[tableName] = tableInserts;
          }
          
          let finalLine = line.replace('INSERT INTO', 'INSERT IGNORE INTO');
          if (tableName === 'employees') {
            finalLine = line.replace(';', ' ON DUPLICATE KEY UPDATE jabatan=VALUES(jabatan), is_active=VALUES(is_active);');
          }
          
          tableInserts.push(finalLine);
        }
      }
    }

    // Execute in dependency order
    const tableOrder = [
      'shifts',
      'devices',
      'admins',
      'employees',
      'holidays',
      'password_resets',
      'attendance'
    ];

    let insertCount = 0;
    for (const table of tableOrder) {
      const tableInserts = inserts[table];
      if (tableInserts) {
        try {
          if (table === 'admins') {
            console.log('Cleaning up existing admins table before seeding...');
            await prisma.$executeRawUnsafe('DELETE FROM `admins`');
          }
          console.log(`Inserting data for table: ${table} (${tableInserts.length} batches)...`);
          for (const sqlLine of tableInserts) {
            await prisma.$executeRawUnsafe(sqlLine);
          }
          insertCount++;
        } catch (err: any) {
          console.error(`Failed to execute INSERT for ${table}:`, err.message);
        }
      }
    }
    console.log(`Successfully executed ${insertCount} bulk INSERT blocks from SQL dump.`);
  } else {
    console.log('No fingerprint_db.sql found. Skipping SQL import.');
  }

  // 4. Import Users from Device JSON
  const jsonPath = path.join(process.cwd(), 'seeds/employees_from_device.json');
  let rawUsers: { userId: string; name: string }[] = [];
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    rawUsers = JSON.parse(rawData);
  } else {
    console.warn('employees_from_device.json not found. Using default mock users.');
    rawUsers = [
      { userId: '1', name: 'Melinda' },
      { userId: '2', name: '' },
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
        ...(u.name && u.name.trim() !== '' ? { nama: u.name } : {}),
        is_active: true,
      },
      create: {
        user_id: u.userId,
        nama: (u.name && u.name.trim() !== '') ? u.name : `Karyawan_${u.userId}`,
        jabatan: employees_jabatan.KARYAWAN,
        shift_id: shift.id,
        status: employees_status.AKTIF,
        is_active: true,
      },
    });
    employees.push(emp);
  }
  console.log(`Upserted ${employees.length} employees from device.`);



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
