const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const admins = await prisma.admins.findMany();
    console.log("Admins:", admins.map(a => ({ id: a.id, username: a.username, email: a.email, name: a.full_name })));
}

main().finally(() => prisma.$disconnect());
