import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const records = await prisma.attendance.findMany({
        where: {
            jam_masuk: { not: null }
        }
    });
    const filtered = records.filter(r => {
        const d = new Date(r.jam_masuk!);
        return d.getUTCHours() === 10 && d.getUTCMinutes() === 11;
    });
    console.log(JSON.stringify(filtered, null, 2));
}

main().finally(() => prisma.$disconnect());
