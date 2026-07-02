import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employees.findMany({
        select: { user_id: true, nama: true, status: true, jabatan: true }
    });
    console.log("All Employees:");
    employees.forEach((e, i) => {
        console.log(`${i + 1}. user_id: "${e.user_id}", nama: "${e.nama}", jabatan: "${e.jabatan}"`);
    });
}

main().finally(() => prisma.$disconnect());
