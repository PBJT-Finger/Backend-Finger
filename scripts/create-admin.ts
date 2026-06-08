import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admins.upsert({
    where: { username: 'admin' },
    update: { password_hash: password },
    create: {
      username: 'admin',
      password_hash: password,
      email: 'admin@example.com',
      full_name: 'Administrator',
      role: 'ADMIN',
      is_active: true,
    },
  });
  console.log('✅ Admin user created/updated:', admin.username);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
