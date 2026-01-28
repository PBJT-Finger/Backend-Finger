const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to extract time from Prisma DateTime (TIME field)
const formatTime = (dateTime) => {
    if (!dateTime) return 'N/A';
    const date = new Date(dateTime);
    // Extract hours and minutes from UTC (MySQL TIME is stored as UTC)
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 SHIFT LOGIC TEST - VERIFICATION                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Check shifts table structure and data
    console.log('📊 PART 1: Shifts Table Verification');
    console.log('─'.repeat(60));

    const shifts = await prisma.shifts.findMany({
        where: { is_active: true }
    });

    console.log(`\nTotal Active Shifts: ${shifts.length}\n`);

    shifts.forEach((shift, index) => {
        console.log(`${index + 1}. ${shift.nama_shift}`);
        console.log(`   ├─ Jam Masuk: ${formatTime(shift.jam_masuk)}`);
        console.log(`   ├─ Jam Keluar: ${formatTime(shift.jam_keluar)}`);
        console.log(`   └─ Deskripsi: ${shift.deskripsi}`);
        console.log('');
    });

    // Verify jam_keluar exists (toleransi_menit should NOT exist)
    const shiftPagi = shifts.find(s => s.nama_shift === 'Shift Pagi');
    const shiftSore = shifts.find(s => s.nama_shift === 'Shift Sore');

    console.log('✅ Verification:');
    console.log(`  - Shift Pagi exists: ${shiftPagi ? 'YES' : 'NO'}`);
    console.log(`  - Shift Sore exists: ${shiftSore ? 'YES' : 'NO'}`);
    console.log(`  - jam_keluar field exists: ${shifts[0].jam_keluar ? 'YES' : 'NO'}`);
    console.log(`  - toleransi_menit field exists: ${shifts[0].toleransi_menit !== undefined ? 'YES (❌ SHOULD NOT)' : 'NO (✅ CORRECT)'}`);

    // 2. Check KARYAWAN late tracking
    console.log('\n\n📊 PART 2: KARYAWAN Late Tracking');
    console.log('─'.repeat(60));

    const karyawanAttendance = await prisma.attendance.groupBy({
        by: ['nama', 'status'],
        where: {
            jabatan: 'KARYAWAN'
        },
        _count: {
            status: true
        }
    });

    const karyawanStats = karyawanAttendance.reduce((acc, curr) => {
        if (!acc[curr.nama]) {
            acc[curr.nama] = { HADIR: 0, TERLAMBAT: 0 };
        }
        acc[curr.nama][curr.status] = curr._count.status;
        return acc;
    }, {});

    console.log('\nKARYAWAN Attendance Summary:\n');
    Object.entries(karyawanStats).forEach(([nama, stats]) => {
        const total = stats.HADIR + stats.TERLAMBAT;
        const tardyPercentage = ((stats.TERLAMBAT / total) * 100).toFixed(1);
        console.log(`${nama}:`);
        console.log(`  ├─ Total Days: ${total}`);
        console.log(`  ├─ HADIR: ${stats.HADIR} days`);
        console.log(`  ├─ TERLAMBAT: ${stats.TERLAMBAT} days (${tardyPercentage}%)`);
        console.log('');
    });

    // 3. Verify DOSEN has no late records
    console.log('\n📊 PART 3: DOSEN Late Tracking (Should be ZERO)');
    console.log('─'.repeat(60));

    const dosenLateCount = await prisma.attendance.count({
        where: {
            jabatan: 'DOSEN',
            status: 'TERLAMBAT'
        }
    });

    const dosenTotalCount = await prisma.attendance.count({
        where: {
            jabatan: 'DOSEN'
        }
    });

    console.log(`\nDOSEN Records:`);
    console.log(`  ├─ Total Records: ${dosenTotalCount}`);
    console.log(`  ├─ HADIR Records: ${dosenTotalCount - dosenLateCount}`);
    console.log(`  └─ TERLAMBAT Records: ${dosenLateCount}`);

    // 4. Sample late time verification for KARYAWAN
    console.log('\n\n📊 PART 4: Sample Late Time Analysis');
    console.log('─'.repeat(60));

    const lateRecords = await prisma.attendance.findMany({
        where: {
            jabatan: 'KARYAWAN',
            status: 'TERLAMBAT'
        },
        select: {
            nama: true,
            tanggal: true,
            jam_masuk: true,
            status: true
        },
        take: 10,
        orderBy: {
            tanggal: 'desc'
        }
    });

    console.log('\nSample TERLAMBAT Records:\n');
    lateRecords.forEach((record, idx) => {
        console.log(`${idx + 1}. ${record.nama} - ${record.tanggal.toISOString().split('T')[0]}`);
        console.log(`   └─ Jam Masuk: ${formatTime(record.jam_masuk)} (Status: ${record.status})`);
    });

    // Final Test Results
    console.log('\n\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎯 TEST RESULTS                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const tests = [
        { name: 'Shift Pagi exists (08:00-15:00)', pass: shiftPagi && formatTime(shiftPagi.jam_masuk) === '08:00:00' && formatTime(shiftPagi.jam_keluar) === '15:00:00' },
        { name: 'Shift Sore exists (16:00-21:00)', pass: shiftSore && formatTime(shiftSore.jam_masuk) === '16:00:00' && formatTime(shiftSore.jam_keluar) === '21:00:00' },
        { name: 'jam_keluar field exists', pass: shifts[0].jam_keluar !== undefined },
        { name: 'toleransi_menit field removed', pass: shifts[0].toleransi_menit === undefined },
        { name: 'DOSEN has no TERLAMBAT records', pass: dosenLateCount === 0 },
        { name: 'KARYAWAN has TERLAMBAT records', pass: karyawanAttendance.some(r => r.status === 'TERLAMBAT') }
    ];

    tests.forEach((test, idx) => {
        const status = test.pass ? '✅ PASS' : '❌ FAIL';
        console.log(`${idx + 1}. ${status} - ${test.name}`);
    });

    const allPassed = tests.every(t => t.pass);

    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED! Shift logic is correct!');
    } else {
        console.log('⚠️  SOME TESTS FAILED! Review the results above.');
    }
    console.log('═'.repeat(60) + '\n');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error('❌ Error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
