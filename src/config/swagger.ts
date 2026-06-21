import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

// Opsi konfigurasi dasar untuk dokumentasi OpenAPI (Swagger)
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0', // Versi spesifikasi OpenAPI yang digunakan
    info: {
      title: 'API Finger - Sistem Absensi Sidik Jari',
      version: '2.0.0',
      description: `**API Finger** adalah sistem manajemen absensi berbasis sidik jari yang dirancang khusus untuk kebutuhan kampus dan institusi.

API REST yang komprehensif untuk mengelola absensi karyawan dengan kemampuan import data absensi dan analitik tingkat lanjut.

**Base URL:** http://localhost:${env.PORT}/api

**Authentication:** Bearer Token (JWT)

**Untuk memulai:** Login menggunakan endpoint /auth/login untuk mendapatkan access token, lalu gunakan token tersebut di header Authorization untuk mengakses endpoint lainnya.`,
      contact: {
        name: 'Tim Pengembangan Backend',
        email: 'admin@kampus.edu',
      },
      license: {
        name: 'Lisensi MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    // Daftar server/URL dasar backend yang tersedia untuk diuji coba langsung
    servers: [
      {
        url: '/',
        description: 'Deteksi Otomatis Lingkungan (Auto-detect)',
      },
      {
        url: 'https://finger-be.pbjt.web.id',
        description: 'Server Produksi (Online)',
      },
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Server Development Lokal (Laptop)',
      },
    ],

    // Daftar Kategori (Tags) untuk mengelompokkan berbagai endpoint API
    tags: [
      {
        name: 'Authentication',
        description:
          'Operasi login pengguna, refresh token, dan logout. Autentikasi berbasis JWT dengan Bearer token.',
      },
      {
        name: 'Import',
        description: 'Upload dan import data absensi manual dari file Excel/CSV',
      },
      {
        name: 'Attendance',
        description: 'Operasi absensi - check in/out, lihat rekaman, dan rekapitulasi',
      },
      {
        name: 'Export',
        description: 'Ekspor data absensi dalam berbagai format (Excel, CSV, PDF)',
      },
      {
        name: 'Dashboard',
        description: 'Statistik dashboard, tren, dan metrik kinerja utama',
      },
      {
        name: 'Report',
        description:
          'Analitik absensi, statistik, dan laporan ringkasan dengan perhitungan persentase',
      },
      {
        name: 'Admin',
        description: 'Manajemen akun admin - CRUD operasi untuk user management sistem',
      },
      {
        name: 'Employees',
        description: 'Manajemen data master pegawai (Dosen dan Karyawan) - CRUD operasi',
      },
      {
        name: 'Device',
        description: 'Operasi perangkat absensi - status, streaming, dan kontrol perangkat',
      },
      {
        name: 'Device Users',
        description: 'Manajemen data user sidik jari pada perangkat (pull, register, update)',
      },
    ],
    // Komponen skema data (Reusable Schemas) untuk input/output API
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan token JWT Anda yang diperoleh dari endpoint login',
        },
      },
      schemas: {
        // Skema untuk data transaksi absensi pegawai
        Attendance: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Auto-increment primary key (ID Transaksi)',
              example: 1234,
            },
            user_id: {
              type: 'string',
              description: 'ID unik pengguna (NIDN/NIP atau ID Alat)',
              example: '198805121234561001',
            },
            nama: {
              type: 'string',
              description: 'Nama lengkap dosen/karyawan',
              example: 'Dr. Budi Santoso, M.Kom',
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Jabatan pegawai',
              example: 'KARYAWAN',
            },
            tanggal: {
              type: 'string',
              format: 'date',
              description: 'Tanggal absensi (Format: YYYY-MM-DD)',
              example: '2026-01-14',
            },
            jam_masuk: {
              type: 'string',
              format: 'time',
              nullable: true,
              description: 'Waktu absen masuk (Format: HH:mm:ss)',
              example: '08:15:00',
            },
            jam_keluar: {
              type: 'string',
              format: 'time',
              nullable: true,
              description: 'Waktu absen pulang (Format: HH:mm:ss)',
              example: '16:30:00',
            },
            device_id: {
              type: 'string',
              nullable: true,
              description: 'ID perangkat absensi fisik tempat melakukan tap sidik jari',
              example: 'FP-GEDUNG-A-001',
            },
            cloud_id: {
              type: 'string',
              nullable: true,
              description: 'ID integrasi cloud',
              example: 'CLOUD-001',
            },
            verification_method: {
              type: 'string',
              description: 'Metode verifikasi (sidik jari, kartu, wajah, kata sandi)',
              example: 'SIDIK_JARI',
            },
            status: {
              type: 'string',
              description: 'Status kehadiran (Tepat Waktu, Terlambat, dll.)',
              example: 'HADIR',
            },
            is_deleted: {
              type: 'boolean',
              description: 'Flag untuk soft delete (apakah data sudah dihapus)',
              example: false,
            },
          },
        },
        // Skema rekapitulasi / ringkasan absensi per pegawai
        AttendanceSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID pegawai',
              example: '198805121234561001',
            },
            no: {
              type: 'integer',
              description: 'Nomor urut baris data',
              example: 1,
            },
            nama: {
              type: 'string',
              description: 'Nama lengkap dosen/karyawan',
              example: 'Dr. Budi Santoso, M.Kom',
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Jabatan pegawai',
              example: 'KARYAWAN',
            },
            totalHadir: {
              type: 'integer',
              description: 'Jumlah hari hadir (berdasarkan absen masuk)',
              example: 18,
            },
            totalHariKerja: {
              type: 'integer',
              description: 'Total hari kerja dalam periode waktu yang dicari',
              example: 18,
            },
            attendanceDates: {
              type: 'string',
              description: 'Rentang tanggal kehadiran (format lokalisasi Indonesia)',
              example: '3 Januari 2026 - 4 Februari 2026',
            },
            lastCheckIn: {
              type: 'string',
              nullable: true,
              description: 'Waktu absen masuk terakhir (format HH:mm)',
              example: '08:10',
            },
            lastCheckOut: {
              type: 'string',
              nullable: true,
              description: 'Waktu absen pulang terakhir (format HH:mm)',
              example: '16:30',
            },
          },
        },
        // Skema metadata pagination hasil query
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Halaman saat ini yang ditampilkan',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Jumlah baris data per halaman',
              example: 50,
            },
            total: {
              type: 'integer',
              description: 'Total seluruh baris data di database',
              example: 150,
            },
            totalPages: {
              type: 'integer',
              description: 'Total halaman yang tersedia',
              example: 3,
            },
            totalWorkingDays: {
              type: 'integer',
              description: 'Total hari kerja dalam periode pencarian',
              example: 22,
            },
          },
        },
        // Skema request login admin
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email admin untuk login',
              example: 'admin@kampus.edu',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Kata sandi admin',
              example: 'admin123',
            },
          },
        },
        // Skema response sukses login
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Login berhasil',
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'integer',
                      example: 1,
                    },
                    username: {
                      type: 'string',
                      example: 'admin',
                    },
                    email: {
                      type: 'string',
                      example: 'admin@kampus.edu',
                    },
                    role: {
                      type: 'string',
                      example: 'ADMIN',
                    },
                  },
                },
                tokens: {
                  type: 'object',
                  properties: {
                    access_token: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    },
                    refresh_token: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    },
                    token_type: {
                      type: 'string',
                      example: 'Bearer',
                    },
                    expires_in: {
                      type: 'integer',
                      description: 'Masa kedaluwarsa access token dalam detik',
                      example: 900,
                    },
                  },
                },
              },
            },
          },
        },
        // Skema error response umum
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Kesalahan validasi data',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'startDate',
                  },
                  message: {
                    type: 'string',
                    example: 'startDate wajib diisi',
                  },
                },
              },
            },
          },
        },
        // Skema error validasi input
        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Validasi input gagal',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
        // Skema error otorisasi/belum login
        UnauthorizedError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Tidak diizinkan - Token tidak valid atau kosong',
            },
          },
        },
        // Skema error resource tidak ditemukan
        NotFoundError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Data tidak ditemukan',
            },
          },
        },
        // Skema error limit request terlampaui
        RateLimitError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti',
            },
          },
        },
      },
      // Kumpulan tipe-tipe Response standar HTTP yang sering digunakan
      responses: {
        Unauthorized: {
          description: 'Tidak diizinkan - Token autentikasi tidak valid atau hilang',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UnauthorizedError',
              },
            },
          },
        },
        ValidationError: {
          description: 'Kesalahan Validasi - Data input tidak sesuai format',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError',
              },
            },
          },
        },
        NotFound: {
          description: 'Data / Resource tidak ditemukan',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NotFoundError',
              },
            },
          },
        },
        RateLimitExceeded: {
          description: 'Batas limit request (Rate Limit) terlampaui',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RateLimitError',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Kesalahan internal server',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false,
                  },
                  message: {
                    type: 'string',
                    example: 'Terjadi kesalahan internal server',
                  },
                },
              },
            },
          },
        },
      },
    },
    // Menerapkan pengaman BearerAuth (token JWT) secara default untuk semua endpoint
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
};

import path from 'path';

// Melakukan inisialisasi modul swagger-jsdoc untuk membaca anotasi JSDoc pada file routes
export const specs = swaggerJsdoc({
  ...options,
  apis: [path.join(__dirname, '../routes/*.ts'), path.join(__dirname, '../routes/*.js')],
});

// Opsi kustomisasi antarmuka (UI) Swagger Express
export const swaggerOptions = {
  explorer: true, // Menampilkan bilah pencarian endpoint di UI
  customCssUrl: '/swagger-custom.css', // Menyematkan berkas CSS kustom untuk mempercantik UI
  customSiteTitle: 'Finger API • Technical Reference', // Mengubah judul tab browser
  customfavIcon: 'https://cdn-icons-png.flaticon.com/512/3064/3064155.png', // Mengubah icon tab browser
  swaggerOptions: {
    persistAuthorization: true, // Menyimpan token otorisasi agar tidak hilang saat halaman di-refresh
    displayRequestDuration: true, // Menampilkan durasi eksekusi request (dalam milidetik)
    docExpansion: 'none', // Menyembunyikan seluruh modul secara bawaan agar rapi
    filter: true, // Mengaktifkan pencarian teks di dalam dokumen
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'nord', // Tema penyorotan sintaks (nord)
    },
    tryItOutEnabled: true, // Mengizinkan pencobaan request langsung dari browser
    requestSnippetsEnabled: true, // Menampilkan potongan kode (code snippets) untuk memanggil API
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null,
    layout: 'BaseLayout',
    deepLinking: true,
    showMutatedRequest: true,
  },
};

export { swaggerUi };
