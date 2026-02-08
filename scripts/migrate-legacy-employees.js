// scripts/migrate-legacy-employees.js
// Prisma-based migration for 23 legacy employees
// Run: node scripts/migrate-legacy-employees.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Data pegawai dari backup microSD
const LEGACY_EMPLOYEES = [
    // ========== DOSEN (21 orang) ==========
    { nip: '850019763', nama: 'Slamet Riyadi, M.T', jabatan: 'DOSEN', deviceUserId: '1', devicePin: '1000' },
    { nip: '850020771', nama: 'Sendie Yuliarto Margen, M.T', jabatan: 'DOSEN', deviceUserId: '2', devicePin: '1001' },
    { nip: '850070351', nama: 'Lily Budinurani, M.Pd', jabatan: 'DOSEN', deviceUserId: '3', devicePin: '1002' },
    { nip: '850110501', nama: 'Ria Candra Dewi, M.Pd', jabatan: 'DOSEN', deviceUserId: '4', devicePin: '1003' },
    { nip: '850019761', nama: 'Atiek Nurindriani, M.Pd', jabatan: 'DOSEN', deviceUserId: '5', devicePin: '1004' },
    { nip: '850018701', nama: 'Aziz Azindani, M.Kom', jabatan: 'DOSEN', deviceUserId: '6', devicePin: '1005' },
    { nip: '850020805', nama: 'Ali Wardana, M.Pd', jabatan: 'DOSEN', deviceUserId: '7', devicePin: '1006' },
    { nip: '850023057', nama: 'Tunggal Ajining Prasetiadi, M.T', jabatan: 'DOSEN', deviceUserId: '8', devicePin: '1007' },
    { nip: '850080388', nama: 'Agung Nugroho, M.T', jabatan: 'DOSEN', deviceUserId: '9', devicePin: '1008' },
    { nip: '850016624', nama: 'Ismi Kusumaningroem, M.Pd', jabatan: 'DOSEN', deviceUserId: '10', devicePin: '1009' },
    { nip: '850023059', nama: 'Ilham Akhsani, S.Tr.Kom', jabatan: 'DOSEN', deviceUserId: '11', devicePin: '1010' },
    { nip: '850110487', nama: 'Budi Pribowo, SST', jabatan: 'DOSEN', deviceUserId: '12', devicePin: '1011' },
    { nip: '850130906', nama: 'Mizar Wahyu Ardani, ST', jabatan: 'DOSEN', deviceUserId: '13', devicePin: '1012' },
    { nip: '850060330', nama: 'Susanto, S.Pd', jabatan: 'DOSEN', deviceUserId: '14', devicePin: '1013' },
    { nip: '850050295', nama: 'Nurul Atiqoh, S.Pd', jabatan: 'DOSEN', deviceUserId: '15', devicePin: '1014' },
    { nip: '850016595', nama: 'Tri Looke Darwanto, S.Kom', jabatan: 'DOSEN', deviceUserId: '16', devicePin: '1015' },
    { nip: '850020813', nama: 'Robiatul Adawiyah, M.Kom', jabatan: 'DOSEN', deviceUserId: '17', devicePin: '1016' },
    { nip: '850022029', nama: 'M Hasan Fatoni, ST', jabatan: 'DOSEN', deviceUserId: '18', devicePin: '1017' },
    { nip: '1018', nama: 'Eko Supriyanto, ST', jabatan: 'DOSEN', deviceUserId: '19', devicePin: '1018' },
    { nip: '1019', nama: 'A Maulana Izzudin, S.Pd', jabatan: 'DOSEN', deviceUserId: '20', devicePin: '1019' },
    { nip: '1020', nama: 'Ayu Ningrum Purnamasari, S.Pd', jabatan: 'DOSEN', deviceUserId: '21', devicePin: '1020' },

    // ========== KARYAWAN (2 orang - Dede & Danil) ==========
    { nip: '1021', nama: 'Dede Harisma', jabatan: 'KARYAWAN', deviceUserId: '22', devicePin: '1021', shiftId: 1 },
    { nip: '1022', nama: 'Danil Firmansyah', jabatan: 'KARYAWAN', deviceUserId: '23', devicePin: '1022', shiftId: 1 },
];

async function main() {
    console.log('🚀 Starting Legacy Employee Migration (Prisma)...\n');
    console.log('📦 Source: 23 pegawai (21 DOSEN + 2 KARYAWAN)');
    console.log('🎯 Target: employees table (via Prisma Client)\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors = [];

    // Migrate employees
    for (const emp of LEGACY_EMPLOYEES) {
        try {
            // Check if already exists
            const existing = await prisma.employees.findUnique({
                where: { nip: emp.nip }
            });

            if (existing) {
                console.log(`⏭️  SKIP: ${emp.nama} (NIP ${emp.nip}) - already exists`);
                skipCount++;
                continue;
            }

            // Create employee
            await prisma.employees.create({
                data: {
                    nip: emp.nip,
                    nama: emp.nama,
                    jabatan: emp.jabatan,
                    shift_id: emp.shiftId || null,
                    status: 'AKTIF',
                    tanggal_masuk: new Date('2024-10-03'),
                    is_active: true,
                }
            });

            console.log(`✅ IMPORTED: ${emp.nama} (${emp.jabatan})`);
            successCount++;

        } catch (error) {
            console.error(`❌ ERROR: ${emp.nama} - ${error.message}`);
            errors.push({ employee: emp.nama, error: error.message });
            errorCount++;
        }
    }

    console.log('\n==================== MIGRATION SUMMARY ====================');
    console.log(`✅ Success: ${successCount} employees imported`);
    console.log(`⏭️  Skipped: ${skipCount} employees (already exist)`);
    console.log(`❌ Errors: ${errorCount} employees failed`);

    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  - ${e.employee}: ${e.error}`));
    }

    // Verify final count
    const totalEmployees = await prisma.employees.count();
    const byJabatan = await prisma.employees.groupBy({
        by: ['jabatan'],
        where: { is_active: true },
        _count: true
    });

    console.log('\n==================== VERIFICATION ====================');
    console.log(`Total Employees in Database: ${totalEmployees}`);
    console.log('\nBreakdown by Jabatan:');
    byJabatan.forEach(group => {
        console.log(`  ${group.jabatan}: ${group._count} employees`);
    });

    // Show newly imported employees
    console.log('\n==================== NEWLY IMPORTED ====================');
    const newEmployees = await prisma.employees.findMany({
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

    console.log(`Total: ${newEmployees.length} employees\n`);
    newEmployees.forEach((emp, idx) => {
        console.log(`${idx + 1}. [${emp.jabatan}] ${emp.nama} (${emp.nip})`);
    });

    console.log('\n✅ Migration completed successfully!\n');
}

main()
    .catch((e) => {
        console.error('💥 Fatal Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
