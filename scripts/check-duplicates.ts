import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const att = await prisma.attendance.findMany({
        where: {
            tanggal: { gte: today, lt: tomorrow },
            is_deleted: false
        },
        orderBy: { created_at: 'desc' }
    });

    console.log("Total attendance today:", att.length);
    const duplicates = att.filter(a => att.filter(b => b.user_id === a.user_id && b.tanggal.getTime() === a.tanggal.getTime()).length > 1);
    console.log("Duplicates count:", duplicates.length);
    console.log("Sample duplicates:", duplicates.map(d => ({ id: d.id, name: d.nama, user_id: d.user_id, status: d.status_keluar, in: d.jam_masuk, out: d.jam_keluar })).slice(0, 5));
}

main().finally(() => prisma.$disconnect());
