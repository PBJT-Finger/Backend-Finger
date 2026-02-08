// scripts/seed-device-mapping.js
// Create employee_device_mapping table and seed data
// Run: node scripts/seed-device-mapping.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Device mapping data (NIP → Device User ID & PIN)
const DEVICE_MAPPINGS = [
    // DOSEN
    { nip: '850019763', device_user_id: '1', device_pin: '1000' },
    { nip: '850020771', device_user_id: '2', device_pin: '1001' },
    { nip: '850070351', device_user_id: '3', device_pin: '1002' },
    { nip: '850110501', device_user_id: '4', device_pin: '1003' },
    { nip: '850019761', device_user_id: '5', device_pin: '1004' },
    { nip: '850018701', device_user_id: '6', device_pin: '1005' },
    { nip: '850020805', device_user_id: '7', device_pin: '1006' },
    { nip: '850023057', device_user_id: '8', device_pin: '1007' },
    { nip: '850080388', device_user_id: '9', device_pin: '1008' },
    { nip: '850016624', device_user_id: '10', device_pin: '1009' },
    { nip: '850023059', device_user_id: '11', device_pin: '1010' },
    { nip: '850110487', device_user_id: '12', device_pin: '1011' },
    { nip: '850130906', device_user_id: '13', device_pin: '1012' },
    { nip: '850060330', device_user_id: '14', device_pin: '1013' },
    { nip: '850050295', device_user_id: '15', device_pin: '1014' },
    { nip: '850016595', device_user_id: '16', device_pin: '1015' },
    { nip: '850020813', device_user_id: '17', device_pin: '1016' },
    { nip: '850022029', device_user_id: '18', device_pin: '1017' },
    { nip: '1018', device_user_id: '19', device_pin: '1018' },
    { nip: '1019', device_user_id: '20', device_pin: '1019' },
    { nip: '1020', device_user_id: '21', device_pin: '1020' },

    // KARYAWAN
    { nip: '1021', device_user_id: '22', device_pin: '1021' },
    { nip: '1022', device_user_id: '23', device_pin: '1022' },
];

async function main() {
    console.log('🚀 Starting Device Mapping Seeding...\n');

    // First, ensure the table exists by running raw SQL
    console.log('📋 Creating employee_device_mapping table if not exists...');
    await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS employee_device_mapping (
      nip VARCHAR(50) PRIMARY KEY COMMENT 'Employee NIP (links to employees table)',
      device_user_id VARCHAR(10) NOT NULL COMMENT 'User ID di fingerprint device',
      device_pin VARCHAR(10) NOT NULL COMMENT 'PIN di fingerprint device (1000-1022)',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_device_pin (device_pin),
      INDEX idx_device_user_id (device_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Mapping NIP to Fingerprint Device User ID & PIN'
  `;
    console.log('✅ Table ready\n');

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    // Seed device mappings
    for (const mapping of DEVICE_MAPPINGS) {
        try {
            // Check if employee exists
            const employee = await prisma.employees.findUnique({
                where: { nip: mapping.nip },
                select: { nama: true, jabatan: true }
            });

            if (!employee) {
                console.log(`⚠️  SKIP: NIP ${mapping.nip} - employee not found in database`);
                continue;
            }

            // Upsert mapping (insert or update)
            await prisma.$executeRaw`
        INSERT INTO employee_device_mapping (nip, device_user_id, device_pin)
        VALUES (${mapping.nip}, ${mapping.device_user_id}, ${mapping.device_pin})
        ON DUPLICATE KEY UPDATE
          device_user_id = VALUES(device_user_id),
          device_pin = VALUES(device_pin),
          updated_at = CURRENT_TIMESTAMP
      `;

            console.log(`✅ MAPPED: ${employee.nama} → PIN ${mapping.device_pin}`);
            successCount++;

        } catch (error) {
            console.error(`❌ ERROR: NIP ${mapping.nip} - ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n==================== SEEDING SUMMARY ====================');
    console.log(`✅ Success: ${successCount} mappings created/updated`);
    console.log(`❌ Errors: ${errorCount} mappings failed`);

    // Verify
    const totalMappings = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM employee_device_mapping
  `;
    console.log(`\n📊 Total mappings in database: ${totalMappings[0].count}`);

    // Show sample mappings
    console.log('\n==================== SAMPLE MAPPINGS ====================');
    const sampleMappings = await prisma.$queryRaw`
    SELECT 
      e.nip,
      e.nama,
      e.jabatan,
      m.device_pin,
      m.device_user_id
    FROM employees e
    INNER JOIN employee_device_mapping m ON e.nip = m.nip
    WHERE e.tanggal_masuk = '2024-10-03'
    ORDER BY e.jabatan, CAST(m.device_pin AS UNSIGNED)
    LIMIT 10
  `;

    sampleMappings.forEach((mapping, idx) => {
        console.log(`${idx + 1}. [${mapping.jabatan}] ${mapping.nama}`);
        console.log(`   NIP: ${mapping.nip} | Device PIN: ${mapping.device_pin} | User ID: ${mapping.device_user_id}`);
    });

    console.log('\n✅ Device mapping seeding completed!\n');
}

main()
    .catch((e) => {
        console.error('💥 Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
