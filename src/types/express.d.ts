/**
 * Augmentasi Tipe Request Express
 *
 * Memperluas tipe bawaan Request Express dengan properti spesifik aplikasi.
 * File ini harus masuk dalam pencarian tsconfig `include` agar TypeScript dapat mengenalnya
 * secara otomatis di seluruh controller dan middleware.
 *
 * Mengapa: Tanpa modifikasi ini, properti `req.user` dan `req.correlationId` akan bertipe `any`
 * atau memicu error TypeScript di mode strict, menyembunyikan pelanggaran tipe data sesungguhnya.
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * Diisi oleh middleware `authenticateToken` setelah verifikasi token JWT berhasil.
       * Bernilai undefined pada rute yang tidak membutuhkan autentikasi.
       */
      user?: AuthenticatedUser;

      /**
       * Pengidentifikasi unik request yang disuntikkan oleh middleware `requestCorrelation`.
       * Digunakan untuk pelacakan terdistribusi (tracing) dan korelasi log terstruktur.
       */
      correlationId?: string;
    }
  }
}

/**
 * Merepresentasikan data user terautentikasi yang diekstrak dari payload token JWT.
 * Mencerminkan field yang dienkode saat pembuatan token di `auth.service.ts`.
 */
export interface AuthenticatedUser {
  /** ID utama (primary key) dari tabel `admins` */
  id: number;
  /** Nama pengguna untuk login */
  username: string;
  /** Kontrol akses berbasis peran (role): 'admin' | 'viewer' */
  role: string;
}

export {};
