// scripts/verify-migration.js
// Verification script untuk cek hasil migration
// Run: node scripts/verify-migration.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Verifying Migration Results...\n');

    // 1. Total employees
    const totalEmployees = await prisma.employees.count({
        where: { is_active: true }
    });
    console.log(`📊 Total Active Employees: ${totalEmployees}`);

    // 2. Count by Jabatan
    const byJabatan = await prisma.employees.groupBy({
        by: ['jabatan'],
        where: { is_active: true },
        _count: true
    });

    console.log('\n📊 Breakdown by Jabatan:');
    byJabatan.forEach(group => {
        console.log(`   ${group.jabatan}: ${group._count} employees`);
    });

    // 3. Check Dede & Danil are KARYAWAN
    console.log('\n✅ Verifying Dede & Danil as KARYAWAN:');
    const dedeAndDanil = await prisma.employees.findMany({
        where: {
            nip: { in: ['1021', '1022'] }
        },
        select: {
            nip: true,
            nama: true,
            jabatan: true
        }
    });

    if (dedeAndDanil.length === 2) {
        dedeAndDanil.forEach(emp => {
            const status = emp.jabatan === 'KARYAWAN' ? '✅' : '❌';
            console.log(`   ${status} ${emp.nama} (${emp.nip}): ${emp.jabatan}`);
        });
    } else {
        console.log('   ❌ Dede or Danil not found in database!');
    }

    // 4. Check device mapping
    const mappingCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM employee_device_mapping
  `;
    console.log(`\n📊 Total Device Mappings: ${mappingCount[0].count}`);

    // 5. Verify device PIN mapping for Dede & Danil
    console.log('\n✅ Verifying Device PIN for Dede & Danil:');
    const deviceMappings = await prisma.$queryRaw`
    SELECT 
      e.nama,
      e.nip,
      m.device_pin,
      m.device_user_id
    FROM employees e
    LEFT JOIN employee_device_mapping m ON e.nip = m.nip
    WHERE e.nip IN ('1021', '1022')
    ORDER BY e.nip
  `;

    deviceMappings.forEach(mapping => {
        const hasPIN = mapping.device_pin ? '✅' : '❌';
        console.log(`   ${hasPIN} ${mapping.nama} → PIN: ${mapping.device_pin || 'NOT MAPPED'}`);
    });

    // 6. Show all imported employees (from migration date)
    console.log('\n📋 All Imported Employees (2024-10-03):');
    const importedEmployees = await prisma.employees.findMany({
        where: {
            tanggal_masuk: new Date('2024-10-03')
        },
        select: {
            nip: true,
            nama: true,
            jabatan: true
        },
        orderBy: [
            { jabatan: 'asc' },
            { nama: 'asc' }
        ]
    });

    if (importedEmployees.length === 0) {
        console.log('   ⚠️  No employees found with tanggal_masuk = 2024-10-03');
        console.log('   Migration may not have been run yet.');
    } else {
        console.log(`   Total: ${importedEmployees.length} employees\n`);

        let currentJabatan = '';
        importedEmployees.forEach((emp, idx) => {
            if (emp.jabatan !== currentJabatan) {
                currentJabatan = emp.jabatan;
                console.log(`\n   === ${currentJabatan} ===`);
            }
            console.log(`   ${idx + 1}. ${emp.nama} (${emp.nip})`);
        });
    }

    // 7. Summary
    console.log('\n==================== VERIFICATION SUMMARY ====================');

    const expectedCount = 23;
    const actualCount = importedEmployees.length;

    if (actualCount === expectedCount) {
        console.log('✅ Migration verified successfully!');
        console.log(`✅ All ${expectedCount} employees imported correctly`);

        const expectedDosen = 21;
        const expectedKaryawan = 2;
        const actualDosen = importedEmployees.filter(e => e.jabatan === 'DOSEN').length;
        const actualKaryawan = importedEmployees.filter(e => e.jabatan === 'KARYAWAN').length;

        if (actualDosen === expectedDosen && actualKaryawan === expectedKaryawan) {
            console.log(`✅ Jabatan mapping correct (${actualDosen} DOSEN + ${actualKaryawan} KARYAWAN)`);
        } else {
            console.log(`⚠️  Jabatan count mismatch:`);
            console.log(`   Expected: ${expectedDosen} DOSEN + ${expectedKaryawan} KARYAWAN`);
            console.log(`   Actual: ${actualDosen} DOSEN + ${actualKaryawan} KARYAWAN`);
        }
    } else {
        console.log(`⚠️  Migration incomplete:`);
        console.log(`   Expected: ${expectedCount} employees`);
        console.log(`   Actual: ${actualCount} employees`);
    }

    console.log('\n');
}

main()
    .catch((e) => {
        console.error('💥 Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
