import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../utils/logger';

// Mendeklarasikan tipe global agar properti 'prisma' dapat diakses secara global di NodeJS
declare global {
  var prisma: PrismaClient<Prisma.PrismaClientOptions, 'query'> | undefined;
}

// Menentukan opsi konfigurasi untuk Prisma Client
const prismaOptions: Prisma.PrismaClientOptions = {
  log: [
    { level: 'query', emit: 'event' }, // Memancarkan query SQL sebagai event agar bisa ditangkap dan dicatat ke log
    { level: 'error', emit: 'stdout' }, // Menulis log error langsung ke stdout (terminal)
    { level: 'warn', emit: 'stdout' },  // Menulis log peringatan langsung ke stdout (terminal)
  ],
  errorFormat: 'minimal', // Format pesan error minimal agar log tetap bersih
};

// Mencegah pembuatan instansi PrismaClient baru setiap kali server di-reload pada mode Development (Hot Reloading).
// Menggunakan instansi global jika sudah ada, atau membuat instansi baru jika belum ada.
export const prisma =
  global.prisma || new PrismaClient<Prisma.PrismaClientOptions, 'query'>(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma; // Menyimpan instansi ke global scope pada mode Development
}

/**
 * Pencatatan Log Query Lambat / Slow Query Logging (Hanya untuk Mode Development)
 * Membantu memantau query database yang lambat dan memakan waktu lebih dari 100ms
 */
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e: Prisma.QueryEvent) => {
    if (e.duration > 100) {
      logger.warn(`Query Lambat (${e.duration}ms): ${e.query}`);
    }
  });
}

// Flag pengunci untuk mencegah pemanggilan pemutusan koneksi (disconnect) ganda secara bersamaan
let isDisconnecting = false;

// Memastikan koneksi Prisma terputus dengan bersih saat aplikasi Node JS akan berhenti (beforeExit)
process.on('beforeExit', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Koneksi Prisma Client berhasil diputus (beforeExit)');
  } catch (error) {
    logger.error('Error saat memutuskan koneksi Prisma Client pada beforeExit:', { error: String(error) });
  }
  process.exit(0);
});

// Memutus koneksi Prisma secara aman saat menerima sinyal interupsi terminal SIGINT (misal Ctrl+C)
process.on('SIGINT', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Koneksi Prisma Client berhasil diputus (SIGINT)');
  } catch (error) {
    logger.error('Error saat memutuskan koneksi Prisma Client pada SIGINT:', { error: String(error) });
  }
  process.exit(0);
});

// Memutus koneksi Prisma secara aman saat menerima sinyal penghentian proses SIGTERM (misal dari sistem docker/hosting)
process.on('SIGTERM', async () => {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
    logger.info('Koneksi Prisma Client berhasil diputus (SIGTERM)');
  } catch (error) {
    logger.error('Error saat memutuskan koneksi Prisma Client pada SIGTERM:', { error: String(error) });
  }
  process.exit(0);
});

export default prisma;
