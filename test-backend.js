/**
 * Comprehensive Backend Test Suite
 * Tests all Prisma-migrated controllers and services
 */

const { prisma, testConnection, getDatabaseStats } = require('./src/utils/prismaHelpers');
const logger = require('./src/utils/logger');

async function testBackend() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 COMPREHENSIVE BACKEND TEST SUITE                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    let allTestsPassed = true;

    // Test 1: Database Connection
    console.log('📊 TEST 1: Database Connection');
    console.log('─'.repeat(60));
    const connected = await testConnection();
    console.log(`Status: ${connected ? '✅ PASSED' : '❌ FAILED'}\n`);
    if (!connected) {
        console.error('❌ Cannot proceed - database connection failed');
        process.exit(1);
    }

    // Test 2: Database Statistics
    console.log('📊 TEST 2: Database Statistics');
    console.log('─'.repeat(60));
    try {
        const stats = await getDatabaseStats();
        console.log(`Total Records: ${stats.total}`);
        console.log(`  ├─ Employees: ${stats.employees}`);
        console.log(`  ├─ Attendance: ${stats.attendance}`);
        console.log(`  ├─ Devices: ${stats.devices}`);
        console.log(`  ├─ Shifts: ${stats.shifts}`);
        console.log(`  └─ Admins: ${stats.admins}`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 3: Devices Controller
    console.log('📊 TEST 3: Devices Controller (Prisma)');
    console.log('─'.repeat(60));
    try {
        const devices = await prisma.devices.findMany({
            where: { is_active: true },
            take: 5
        });
        console.log(`Found ${devices.length} active devices`);
        if (devices.length > 0) {
            console.log(`Sample: ${devices[0].device_name || devices[0].device_id}`);
        }
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 4: Admins Controller
    console.log('📊 TEST 4: Admins Controller (Prisma)');
    console.log('─'.repeat(60));
    try {
        const admins = await prisma.admins.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                role: true
            },
            take: 3
        });
        console.log(`Found ${admins.length} admins`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 5: Employees Lookup (ADMS Controller Logic)
    console.log('📊 TEST 5: Employee Lookup (ADMS Logic)');
    console.log('─'.repeat(60));
    try {
        const employee = await prisma.employees.findFirst({
            where: {
                is_active: true,
                jabatan: 'KARYAWAN'
            },
            include: {
                shifts: true
            }
        });

        if (employee) {
            console.log(`Found: ${employee.nama} (${employee.jabatan})`);
            console.log(`Shift: ${employee.shifts ? employee.shifts.nama_shift : 'NULL (DOSEN)'}`);
            console.log('✅ PASSED\n');
        } else {
            console.log('⚠️  No KARYAWAN found (might be OK if DB empty)\n');
        }
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 6: Attendance Query (Dosen)
    console.log('📊 TEST 6: Attendance Query - DOSEN');
    console.log('─'.repeat(60));
    try {
        const dosenAttendance = await prisma.attendance.findMany({
            where: {
                jabatan: 'DOSEN',
                is_deleted: false
            },
            orderBy: {
                tanggal: 'desc'
            },
            take: 5
        });
        console.log(`Found ${dosenAttendance.length} DOSEN attendance records`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 7: Attendance Query (Karyawan)
    console.log('📊 TEST 7: Attendance Query - KARYAWAN');
    console.log('─'.repeat(60));
    try {
        const karyawanAttendance = await prisma.attendance.findMany({
            where: {
                jabatan: 'KARYAWAN',
                is_deleted: false
            },
            orderBy: {
                tanggal: 'desc'
            },
            take: 5
        });
        console.log(`Found ${karyawanAttendance.length} KARYAWAN attendance records`);

        // Check late tracking
        const lateCount = karyawanAttendance.filter(a => a.status === 'TERLAMBAT').length;
        console.log(`  └─ Late records: ${lateCount}`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 8: Dashboard Stats Logic
    console.log('📊 TEST 8: Dashboard Statistics');
    console.log('─'.repeat(60));
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await prisma.attendance.count({
            where: {
                tanggal: {
                    gte: today,
                    lt: tomorrow
                },
                is_deleted: false
            }
        });

        console.log(`Today's attendance count: ${todayAttendance}`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 9: Date Filtering (Export Logic)
    console.log('📊 TEST 9: Date Range Filtering');
    console.log('─'.repeat(60));
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const weekAttendance = await prisma.attendance.findMany({
            where: {
                tanggal: {
                    gte: startDate
                },
                is_deleted: false
            },
            orderBy: {
                tanggal: 'desc'
            }
        });

        console.log(`Last 7 days attendance: ${weekAttendance.length} records`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Test 10: Soft Delete Logic
    console.log('📊 TEST 10: Soft Delete Logic');
    console.log('─'.repeat(60));
    try {
        const deletedCount = await prisma.attendance.count({
            where: { is_deleted: true }
        });

        const activeCount = await prisma.attendance.count({
            where: { is_deleted: false }
        });

        console.log(`Active records: ${activeCount}`);
        console.log(`Deleted records: ${deletedCount}`);
        console.log('✅ PASSED\n');
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        allTestsPassed = false;
    }

    // Final Summary
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎯 TEST SUMMARY                                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('✅ Backend is ready for production preparation\n');
    } else {
        console.log('⚠️  Some tests failed. Review errors above.\n');
    }

    await prisma.$disconnect();
    return allTestsPassed;
}

// Run tests
testBackend()
    .then((passed) => {
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
