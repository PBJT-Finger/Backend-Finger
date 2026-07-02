const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const att = await prisma.attendance.findMany({
        orderBy: { id: 'desc' },
        take: 100
    });

    let dupeCount = 0;
    for (let i = 0; i < att.length; i++) {
        for (let j = i + 1; j < att.length; j++) {
            if (att[i].user_id === att[j].user_id && att[i].tanggal.getTime() === att[j].tanggal.getTime() && att[i].is_deleted === false && att[j].is_deleted === false) {
                console.log(`DUPLICATE FOUND for user: ${att[i].nama} on date ${att[i].tanggal.toISOString()}`);
                console.log(` - Row 1: ID=${att[i].id}, In=${att[i].jam_masuk}, Out=${att[i].jam_keluar}`);
                console.log(` - Row 2: ID=${att[j].id}, In=${att[j].jam_masuk}, Out=${att[j].jam_keluar}`);
                dupeCount++;
            }
        }
    }

    if (dupeCount === 0) console.log("NO DUPLICATES IN DATABASE ROWS.");

    console.log("\nChecking for Melinda...");
    const emp = await prisma.employees.findFirst({ where: { user_id: '1' } });
    if (emp) console.log("MELINDA FOUND IN EMPLOYEES:", emp);
    else console.log("Melinda (ID 1) NOT in employees table.");

    const empByName = await prisma.employees.findMany({ where: { nama: { contains: 'Melinda' } } });
    if (empByName.length > 0) console.log("MELINDA FOUND BY NAME:", empByName);
}

main().finally(() => prisma.$disconnect());
