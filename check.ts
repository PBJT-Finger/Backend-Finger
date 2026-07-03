import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const logs = await prisma.attendance.findMany({
        where: {
            tanggal: today
        },
        take: 50,
        orderBy: { created_at: 'desc' }
    });

    console.log(JSON.stringify(logs, null, 2));
}

main().finally(() => prisma.$disconnect());
