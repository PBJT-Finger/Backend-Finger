import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const resultAtt = await prisma.attendance.deleteMany({
        where: { user_id: '1' }
    });
    console.log(`Menghapus ${resultAtt.count} riwayat absen milik Melinda`);

    const resultEmp = await prisma.employees.deleteMany({
        where: { user_id: '1' }
    });
    console.log(`Menghapus ${resultEmp.count} data pegawai milik Melinda`);
}

main().finally(() => prisma.$disconnect());
