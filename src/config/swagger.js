// src/config/swagger.js - Enhanced Swagger Documentation Configuration
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Finger - Sistem Absensi Sidik Jari',
      version: '2.0.0',
      description: `**API Finger** adalah sistem manajemen absensi berbasis sidik jari yang dirancang khusus untuk kebutuhan kampus dan institusi.

API REST yang komprehensif untuk mengelola absensi karyawan dengan kemampuan import data absensi dan analitik tingkat lanjut.

**Base URL:** http://localhost:${process.env.PORT || 3333}/api

**Authentication:** Bearer Token (JWT)

**Untuk memulai:** Login menggunakan endpoint /auth/login untuk mendapatkan access token, lalu gunakan token tersebut di header Authorization untuk mengakses endpoint lainnya.`,
      contact: {
        name: 'Tim Pengembangan Backend',
        email: 'admin@kampus.edu'
      },
      license: {
        name: 'Lisensi MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3333}`,
        description: 'Development Server (dynamic port from env)'
      },
      {
        url: `http://localhost:${process.env.PORT || 3333}/api`,
        description: 'API Base URL'
      },
      {
        url: 'https://api.kampus.edu',
        description: 'Production server (example)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer {token}'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description:
          'Operasi login pengguna, refresh token, dan logout. Autentikasi berbasis JWT dengan Bearer token.'
      },
      {
        name: 'Import',
        description: 'Upload dan import data absensi manual dari file Excel/CSV'
      },
      {
        name: 'Attendance',
        description:
          'Operasi absensi - check in/out, lihat rekaman, dan rekapitulasi'
      },
      {
        name: 'Export',
        description: 'Ekspor data absensi dalam berbagai format (Excel, CSV, PDF)'
      },
      {
        name: 'Dashboard',
        description: 'Statistik dashboard, tren, dan metrik kinerja utama'
      },
      {
        name: 'Report',
        description:
          'Analitik absensi, statistik, dan laporan ringkasan dengan perhitungan persentase'
      },
      {
        name: 'Admin',
        description: 'Manajemen akun admin - CRUD operasi untuk user management sistem'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan token JWT Anda yang diperoleh dari endpoint login'
        }
      },
      schemas: {

        // ==================== ATTENDANCE ====================
        // Berdasarkan tabel `attendance` di database (via Prisma schema)
        Attendance: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Auto-increment primary key',
              example: 1234
            },
            user_id: {
              type: 'string',
              description: 'ID pengguna (sama dengan NIP)',
              example: '198805121234561001'
            },
            nip: {
              type: 'string',
              description: 'Nomor Induk Pegawai',
              example: '198805121234561001'
            },
            nama: {
              type: 'string',
              description: 'Nama karyawan/dosen',
              example: 'Dr. Budi Santoso, M.Kom'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Jabatan karyawan',
              example: 'KARYAWAN'
            },
            tanggal: {
              type: 'string',
              format: 'date',
              description: 'Tanggal absensi (YYYY-MM-DD)',
              example: '2026-01-14'
            },
            jam_masuk: {
              type: 'string',
              format: 'time',
              nullable: true,
              description: 'Waktu check-in (HH:mm:ss)',
              example: '08:15:00'
            },
            jam_keluar: {
              type: 'string',
              format: 'time',
              nullable: true,
              description: 'Waktu check-out (HH:mm:ss)',
              example: '16:30:00'
            },
            device_id: {
              type: 'string',
              nullable: true,
              description: 'ID perangkat absensi',
              example: 'FP-GEDUNG-A-001'
            },
            cloud_id: {
              type: 'string',
              nullable: true,
              description: 'ID cloud sistem',
              example: 'CLOUD-001'
            },
            verification_method: {
              type: 'string',
              description: 'Metode verifikasi absensi',
              example: 'SIDIK_JARI'
            },
            status: {
              type: 'string',
              description: 'Status kehadiran',
              example: 'HADIR'
            },
            is_deleted: {
              type: 'boolean',
              description: 'Soft delete flag',
              example: false
            }
          }
        },

        // ==================== ATTENDANCE SUMMARY ====================
        // Berdasarkan response aktual dari AttendanceController.getAttendanceSummary
        AttendanceSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'NIP / User ID',
              example: '198805121234561001'
            },
            no: {
              type: 'integer',
              description: 'Nomor urut',
              example: 1
            },
            nama: {
              type: 'string',
              description: 'Nama karyawan/dosen',
              example: 'Dr. Budi Santoso, M.Kom'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Jabatan karyawan',
              example: 'KARYAWAN'
            },
            totalHadir: {
              type: 'integer',
              description: 'Jumlah hari hadir (berdasarkan check-in)',
              example: 18
            },
            totalHariKerja: {
              type: 'integer',
              description: 'Total hari kerja dalam periode',
              example: 18
            },
            attendanceDates: {
              type: 'string',
              description: 'Rentang tanggal kehadiran (format Indonesia)',
              example: '3 Januari 2026 - 4 Februari 2026'
            },
            lastCheckIn: {
              type: 'string',
              nullable: true,
              description: 'Waktu check-in terakhir (HH:mm)',
              example: '08:10'
            },
            lastCheckOut: {
              type: 'string',
              nullable: true,
              description: 'Waktu check-out terakhir (HH:mm)',
              example: '16:30'
            }
          }
        },

        // ==================== PAGINATION ====================
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Current page number',
              example: 1
            },
            limit: {
              type: 'integer',
              description: 'Records per page',
              example: 50
            },
            total: {
              type: 'integer',
              description: 'Total number of records',
              example: 150
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages',
              example: 3
            },
            totalWorkingDays: {
              type: 'integer',
              description: 'Total working days in the period (for summary endpoints)',
              example: 22
            }
          }
        },

        // ==================== AUTH ====================
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email (used for login)',
              example: 'admin@kampus.edu'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Admin password',
              example: 'admin123'
            }
          }
        },

        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login successful'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'integer',
                      example: 1
                    },
                    username: {
                      type: 'string',
                      example: 'admin'
                    },
                    email: {
                      type: 'string',
                      example: 'admin@kampus.edu'
                    },
                    role: {
                      type: 'string',
                      example: 'ADMIN'
                    }
                  }
                },
                tokens: {
                  type: 'object',
                  properties: {
                    access_token: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    refresh_token: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    token_type: {
                      type: 'string',
                      example: 'Bearer'
                    },
                    expires_in: {
                      type: 'integer',
                      description: 'Access token expiry in seconds',
                      example: 900
                    }
                  }
                }
              }
            }
          }
        },

        // ==================== ERROR RESPONSES ====================
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Validation error'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'startDate'
                  },
                  message: {
                    type: 'string',
                    example: 'startDate is required'
                  }
                }
              }
            }
          }
        },

        ValidationError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Input validation failed'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },

        UnauthorizedError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Unauthorized - Invalid or missing token'
            }
          }
        },

        NotFoundError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Resource not found'
            }
          }
        },

        RateLimitError: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Too many requests from this IP, please try again later'
            }
          }
        }
      },

      // ==================== COMMON RESPONSES ====================
      responses: {
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication token',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UnauthorizedError'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error - Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/NotFoundError'
              }
            }
          }
        },
        RateLimitExceeded: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RateLimitError'
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: {
                    type: 'boolean',
                    example: false
                  },
                  message: {
                    type: 'string',
                    example: 'Internal server error'
                  }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path to the API docs
};

const specs = swaggerJsdoc(options);

// Swagger options - using external CSS file
const swaggerOptions = {
  explorer: true,
  customCssUrl: '/swagger-custom.css', // Load from static file
  customSiteTitle: 'Finger API • Technical Reference',
  customfavIcon: 'https://cdn-icons-png.flaticon.com/512/3064/3064155.png',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'nord' // Modern dark theme
    },
    tryItOutEnabled: true,
    requestSnippetsEnabled: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
    validatorUrl: null,
    // Custom layout
    layout: 'BaseLayout',
    deepLinking: true,
    showMutatedRequest: true
  }
};

module.exports = {
  swaggerUi,
  specs,
  swaggerOptions
};
