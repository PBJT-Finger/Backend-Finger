// scripts/cleanup-dummy-employees.js
// Delete existing dummy employees (6 DOSEN + 5 KARYAWAN)
// Keep only the 23 migrated employees from legacy data
// Run: node scripts/cleanup-dummy-employees.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// NIP dari dummy employees yang harus dihapus
// (6 DOSEN + 5 KARYAWAN yang dibuat sebelumnya untuk testing)
const DUMMY_EMPLOYEES_TO_DELETE = {
    DOSEN: [
        '198805121234561001', // Dr. Ahmad Hidayat, M.Kom
        '198206151234572001', // Dr. Siti Nurhaliza, M.T
        '198512181234563001', // Dr. Budi Prasetyo, M.Kom
        '198703201234564001', // Dr. Ratna Sari, M.T
        '198909221234565001', // Dr. Eko Wijaya, M.Kom
        '199011251234566001', // Dr. Dewi Lestari, M.T
    ],
    KARYAWAN: [
        '198801152000121001', // Andi Wijaya
        '199002172000122001', // Budi Santoso
        '198905192000123001', // Citra Dewi
        '199103212000124001', // Dani Firmansyah (bukan Danil dari migration)
        '198806232000125001', // Eka Putri
    ]
};

async function main() {
    console.log('🧹 Starting Dummy Employee Cleanup...\n');

    const allDummyNIPs = [
        ...DUMMY_EMPLOYEES_TO_DELETE.DOSEN,
        ...DUMMY_EMPLOYEES_TO_DELETE.KARYAWAN
    ];

    console.log(`📋 Will delete ${allDummyNIPs.length} dummy employees:`);
    console.log(`   - ${DUMMY_EMPLOYEES_TO_DELETE.DOSEN.length} DOSEN`);
    console.log(`   - ${DUMMY_EMPLOYEES_TO_DELETE.KARYAWAN.length} KARYAWAN\n`);

    // Show employees to be deleted
    const employeesToDelete = await prisma.employees.findMany({
        where: {
            nip: { in: allDummyNIPs }
        },
        select: {
            nip: true,
            nama: true,
            jabatan: true
        }
    });

    if (employeesToDelete.length === 0) {
        console.log('✅ No dummy employees found. Database already clean!\n');
        return;
    }

    console.log('📝 Employees to be deleted:');
    employeesToDelete.forEach((emp, idx) => {
        console.log(`   ${idx + 1}. [${emp.jabatan}] ${emp.nama} (${emp.nip})`);
    });

    console.log('\n⚠️  WARNING: This will permanently delete these employees!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

    // Countdown delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete related attendance records first (cascade)
    console.log('🗑️  Deleting related attendance records...');
    const attendanceDeleted = await prisma.attendance.deleteMany({
        where: {
            nip: { in: allDummyNIPs }
        }
    });
    console.log(`   ✅ Deleted ${attendanceDeleted.count} attendance records\n`);

    // Delete employees
    console.log('🗑️  Deleting employees...');
    const employeesDeleted = await prisma.employees.deleteMany({
        where: {
            nip: { in: allDummyNIPs }
        }
    });
    console.log(`   ✅ Deleted ${employeesDeleted.count} employees\n`);

    // Verify final state
    console.log('==================== VERIFICATION ====================');
    const finalCount = await prisma.employees.groupBy({
        by: ['jabatan'],
        where: { is_active: true },
        _count: true
    });

    console.log('📊 Remaining Employees:');
    finalCount.forEach(group => {
        console.log(`   ${group.jabatan}: ${group._count} employees`);
    });

    // Check migration employees still exist
    console.log('\n✅ Verifying migrated employees (2024-10-03):');
    const migratedCount = await prisma.employees.count({
        where: {
            tanggal_masuk: new Date('2024-10-03')
        }
    });
    console.log(`   Total: ${migratedCount} employees (expected: 23)`);

    if (migratedCount === 23) {
        console.log('   ✅ All migrated employees intact!');
    } else {
        console.log(`   ⚠️  Warning: Expected 23, found ${migratedCount}`);
    }

    console.log('\n✅ Cleanup completed successfully!\n');
}

main()
    .catch((e) => {
        console.error('💥 Error during cleanup:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
