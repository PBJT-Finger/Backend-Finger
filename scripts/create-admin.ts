/**
 * scripts/create-admin.ts
 *
 * Skrip utilitas CLI untuk membuat atau memperbarui akun administrator default di database.
 * Berguna saat inisialisasi awal sistem atau ketika perlu mereset kata sandi admin.
 */
import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  // Melakukan hashing kata sandi default 'admin123' dengan salt round 10
  const password = await bcrypt.hash('admin123', 10);
  
  // Melakukan upsert (buat jika belum ada, perbarui jika sudah ada) untuk admin
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
  console.log('✅ Akun admin berhasil dibuat/diperbarui:', admin.username);
}

// Menjalankan fungsi utama, menangani kesalahan, dan memutuskan koneksi Prisma
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
