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
        name: 'Attendance',
        description:
          'Operasi absensi sidik jari - check in/out, lihat rekaman, dan manajemen absensi'
      },
      {
        name: 'Report',
        description:
          'Analitik absensi, statistik, dan laporan ringkasan dengan perhitungan persentase'
      },
      {
        name: 'Dashboard',
        description: 'Statistik dashboard, tren, dan metrik kinerja utama'
      },
      {
        name: 'Export',
        description: 'Ekspor data absensi dalam berbagai format (Excel, CSV, PDF)'
      },
      {
        name: 'Admin',
        description: 'Manajemen akun admin - CRUD operasi untuk user management sistem'
      },
      {
        name: 'System',
        description: 'Health check, monitoring, dan metrik sistem'
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
        // ==================== EMPLOYEE ====================
        Employee: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID karyawan unik',
              example: 1
            },
            nip: {
              type: 'string',
              description: 'Nomor Induk Pegawai (unique)',
              example: '199001012020011001'
            },
            nama: {
              type: 'string',
              description: 'Nama lengkap',
              example: 'Dr. Budi Santoso, M.Kom'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Tipe jabatan',
              example: 'KARYAWAN'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'budi.santoso@kampus.edu'
            },
            phone: {
              type: 'string',
              example: '08123456789'
            },
            shift_id: {
              type: 'integer',
              nullable: true,
              description: 'Penugasan shift (NULL untuk DOSEN - jadwal fleksibel)',
              example: 1
            },
            status: {
              type: 'string',
              enum: ['AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF'],
              description: 'Status kepegawaian',
              example: 'AKTIF'
            },
            tanggal_masuk: {
              type: 'string',
              format: 'date',
              description: 'Tanggal bergabung',
              example: '2020-01-01'
            },
            is_active: {
              type: 'boolean',
              description: 'Status aktif',
              example: true
            }
          }
        },

        // ==================== SHIFT ====================
        Shift: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            nama_shift: {
              type: 'string',
              description: 'Nama shift',
              example: 'Shift Pagi'
            },
            jam_masuk: {
              type: 'string',
              format: 'time',
              description: 'Waktu check-in yang diharapkan',
              example: '08:00:00'
            },
            toleransi_menit: {
              type: 'integer',
              description: 'Masa tenggang dalam menit',
              example: 0
            },
            deskripsi: {
              type: 'string',
              example: 'Shift pagi untuk staff - masuk jam 08:00'
            },
            is_active: {
              type: 'boolean',
              example: true
            }
          }
        },

        // ==================== ATTENDANCE ====================
        Attendance: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID rekaman absensi',
              example: 1234
            },
            cloud_id: {
              type: 'string',
              description: 'Identifikasi sistem cloud',
              example: 'CLOUD-001'
            },
            device_id: {
              type: 'string',
              description: 'ID perangkat sidik jari',
              example: 'FP-DEVICE-01'
            },
            user_id: {
              type: 'string',
              description: 'Identifikasi pengguna dari perangkat',
              example: 'USER-001'
            },
            nama: {
              type: 'string',
              description: 'Nama karyawan',
              example: 'Budi Santoso'
            },
            nip: {
              type: 'string',
              description: 'NIP (Nomor Induk Pegawai)',
              example: '199001012020011001'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Jabatan',
              example: 'KARYAWAN'
            },
            tanggal_absensi: {
              type: 'string',
              format: 'date',
              description: 'Tanggal absensi (YYYY-MM-DD)',
              example: '2026-01-14'
            },
            waktu_absensi: {
              type: 'string',
              format: 'time',
              description: 'Waktu absensi (HH:mm:ss)',
              example: '08:15:30'
            },
            tipe_absensi: {
              type: 'string',
              enum: ['MASUK', 'PULANG'],
              description: 'Check-in atau check-out',
              example: 'MASUK'
            },
            verifikasi: {
              type: 'string',
              description: 'Metode verifikasi',
              example: 'SIDIK_JARI'
            }
          }
        },

        // ==================== ATTENDANCE SUMMARY ====================
        AttendanceSummary: {
          type: 'object',
          properties: {
            nip: {
              type: 'string',
              example: '199001012020011001'
            },
            nama: {
              type: 'string',
              example: 'Budi Santoso'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              example: 'KARYAWAN'
            },
            shift: {
              type: 'string',
              description: 'Shift name or "Fleksibel" for DOSEN',
              example: 'Shift Pagi'
            },
            hadir: {
              type: 'integer',
              description: 'Number of days present (with check-in)',
              example: 18
            },
            totalHariKerja: {
              type: 'integer',
              description: 'Total working days (excluding weekends & holidays)',
              example: 22
            },
            terlambat: {
              type: 'integer',
              description: 'Number of late days (shift-based for KARYAWAN, 0 for DOSEN)',
              example: 3
            },
            presentase: {
              type: 'number',
              format: 'float',
              description: 'Attendance percentage',
              example: 81.82
            },
            checkInTerakhir: {
              type: 'object',
              nullable: true,
              properties: {
                tanggal: {
                  type: 'string',
                  format: 'date',
                  example: '2026-01-14'
                },
                waktu: {
                  type: 'string',
                  format: 'time',
                  example: '08:15:00'
                }
              }
            },
            checkOutTerakhir: {
              type: 'object',
              nullable: true,
              properties: {
                tanggal: {
                  type: 'string',
                  format: 'date',
                  example: '2026-01-14'
                },
                waktu: {
                  type: 'string',
                  format: 'time',
                  example: '17:30:00'
                }
              }
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
