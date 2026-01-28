const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Testing Prisma Connection...\n');

    try {
        // Test 1: Count employees
        const employeeCount = await prisma.employees.count();
        console.log(`✅ Employees table: ${employeeCount} records`);

        // Test 2: Count attendance
        const attendanceCount = await prisma.attendance.count();
        console.log(`✅ Attendance table: ${attendanceCount} records`);

        // Test 3: Count devices
        const deviceCount = await prisma.devices.count();
        console.log(`✅ Devices table: ${deviceCount} records`);

        // Test 4: Get first employee
        const firstEmployee = await prisma.employees.findFirst({
            select: {
                nip: true,
                nama: true,
                jabatan: true
            }
        });

        if (firstEmployee) {
            console.log(`\n📋 Sample Employee:`);
            console.log(`   NIP: ${firstEmployee.nip}`);
            console.log(`   Nama: ${firstEmployee.nama}`);
            console.log(`   Jabatan: ${firstEmployee.jabatan}`);
        }

        // Test 5: Get sample attendance
        const sampleAttendance = await prisma.attendance.findFirst({
            select: {
                nip: true,
                nama: true,
                tanggal: true,
                jam_masuk: true,
                status: true
            }
        });

        if (sampleAttendance) {
            console.log(`\n📅 Sample Attendance:`);
            console.log(`   NIP: ${sampleAttendance.nip}`);
            console.log(`   Nama: ${sampleAttendance.nama}`);
            console.log(`   Tanggal: ${sampleAttendance.tanggal}`);
            console.log(`   Jam Masuk: ${sampleAttendance.jam_masuk}`);
            console.log(`   Status: ${sampleAttendance.status}`);
        }

        console.log('\n🎉 Prisma connection test SUCCESSFUL!\n');

    } catch (error) {
        console.error('\n❌ Prisma connection test FAILED!');
        console.error('Error:', error.message);
        console.error('\nPlease check:');
        console.error('1. DATABASE_URL in .env is correct');
        console.error('2. MySQL server is running');
        console.error('3. Database "finger_db" exists');
        console.error('4. Prisma schema is generated (run: bunx prisma generate)\n');
        process.exit(1);
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
        console.log('✅ Disconnected from database');
    })
    .catch(async (e) => {
        console.error('Fatal error:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
