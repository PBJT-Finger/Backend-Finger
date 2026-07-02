import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employees.findMany({
        where: { nama: { contains: 'Melinda' } }
    });
    console.log("Employees:", employees);

    const attendance = await prisma.attendance.findMany({
        where: { nama: { contains: 'Melinda' } },
        take: 5
    });
    console.log("Attendance:", attendance);
}

main().finally(() => prisma.$disconnect());
