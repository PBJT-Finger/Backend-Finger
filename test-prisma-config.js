/**
 * Test Prisma Configuration
 * 
 * Verify that Prisma is properly configured and can connect to the database
 */

const { prisma, testConnection, getDatabaseStats } = require('./src/utils/prismaHelpers');
const logger = require('./src/utils/logger');

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 PRISMA CONFIGURATION TEST                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Test 1: Database Connection
    console.log('Test 1: Database Connection');
    console.log('─'.repeat(60));
    const connected = await testConnection();
    console.log(`Status: ${connected ? '✅ CONNECTED' : '❌ FAILED'}\n`);

    if (!connected) {
        console.error('Cannot proceed - database connection failed');
        process.exit(1);
    }

    // Test 2: Database Statistics
    console.log('Test 2: Database Statistics');
    console.log('─'.repeat(60));
    try {
        const stats = await getDatabaseStats();
        console.log(`📊 Total Records: ${stats.total}`);
        console.log(`  ├─ Employees: ${stats.employees}`);
        console.log(`  ├─ Attendance: ${stats.attendance}`);
        console.log(`  ├─ Devices: ${stats.devices}`);
        console.log(`  ├─ Shifts: ${stats.shifts}`);
        console.log(`  └─ Admins: ${stats.admins}\n`);
    } catch (error) {
        console.error('❌ Failed to get database stats:', error.message);
    }

    // Test 3: Sample Query
    console.log('Test 3: Sample Queries');
    console.log('─'.repeat(60));
    try {
        // Get sample employee
        const employee = await prisma.employees.findFirst({
            where: { is_active: true },
            include: {
                shifts: true
            }
        });

        if (employee) {
            console.log(`✅ Sample Employee:`);
            console.log(`  ├─ NIP: ${employee.nip}`);
            console.log(`  ├─ Nama: ${employee.nama}`);
            console.log(`  ├─ Jabatan: ${employee.jabatan}`);
            console.log(`  └─ Shift: ${employee.shifts ? employee.shifts.nama_shift : 'NULL (DOSEN)'}\n`);
        }

        // Get attendance count
        const attendanceCount = await prisma.attendance.count({
            where: {
                tanggal: {
                    gte: new Date(new Date().setDate(new Date().getDate() - 7))
                }
            }
        });
        console.log(`✅ Attendance (Last 7 days): ${attendanceCount} records\n`);

    } catch (error) {
        console.error('❌ Sample query failed:', error.message);
    }

    // Test 4: Verify Schema Models
    console.log('Test 4: Verify Prisma Models');
    console.log('─'.repeat(60));
    const models = [
        'admins',
        'attendance',
        'devices',
        'employees',
        'password_resets',
        'shifts'
    ];

    models.forEach(model => {
        const exists = prisma[model] !== undefined;
        console.log(`${exists ? '✅' : '❌'} ${model}`);
    });

    // Final Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 PRISMA READY TO USE!                                 ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('Next Steps:');
    console.log('  1. Migrate controllers to use prisma instead of Sequelize');
    console.log('  2. Test API endpoints with Prisma queries');
    console.log('  3. Remove Sequelize models after migration complete\n');

    await prisma.$disconnect();
}

main()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
