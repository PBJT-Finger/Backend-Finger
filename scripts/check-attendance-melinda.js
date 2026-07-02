const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const atts = await prisma.attendance.findMany({
        where: { user_id: '1', is_deleted: false }
    });
    console.log("Melinda in Attendance:", atts.length, "records");
    if (atts.length > 0) {
        console.log("Sample:", atts.slice(0, 3));
    }
}

main().finally(() => prisma.$disconnect());
