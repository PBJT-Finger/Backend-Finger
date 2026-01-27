// src/config/swagger.js - Enhanced Swagger Documentation Configuration
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finger API',
      version: '2.0.0',
      description: `
# Enterprise Attendance Management System

**Finger API** is a fingerprint-based attendance management system integrated with ADMS devices, designed for campus and institutional use with enterprise-grade features.

---

## Overview

A comprehensive REST API for managing employee attendance with fingerprint integration, real-time synchronization, and advanced analytics capabilities.

---

## Core Features

### Security & Authentication
- JWT-based authentication with refresh token rotation
- Token blacklist with Redis-based revocation
- Multi-tier rate limiting (IP + per-user)
- Input validation and sanitization
- CORS and security headers
- PII log redaction for compliance

### Attendance Management
- Real-time fingerprint device integration (ADMS)
- Multiple check-in/check-out per day
- Shift-based lateness detection for employees
- Flexible scheduling for faculty
- Automatic working days calculation (Sunday as weekend)

### Analytics & Reporting
- Comprehensive attendance summary
- Attendance percentage calculation
- Lateness tracking
- Export to Excel, CSV, PDF formats
- Dashboard with real-time statistics

### Device Integration
- Real-time sync with ADMS fingerprint devices
- API key authentication for devices
- HMAC signature validation
- Automatic data validation

---

## Technical Specifications

| Specification | Value |
|--------------|-------|
| **Protocol** | REST API over HTTP/HTTPS |
| **Format** | JSON (UTF-8) |
| **Authentication** | JWT (HS256) with Bearer token |
| **Timezone** | Asia/Jakarta (UTC+7) |
| **Database** | MySQL 8.0+ |
| **Cache** | Redis 7.0+ |
| **Security Score** | 9.5/10 (Enterprise-grade) |

---

## Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| **Auth (Login)** | 5 requests | 15 minutes |
| **Summary API** | 30 requests | 5 minutes |
| **Export API** | 10 requests | 1 hour |
| **Dashboard API** | 20 requests | 1 minute |
| **ADMS Push** | 100 requests | 1 minute |
| **General API** | 100 requests | 15 minutes |
| **Per-User Limit (Moderate)** | 200 requests | 15 minutes |
| **Per-User Limit (Strict)** | 50 requests | 15 minutes |

---

## Response Format

All API responses follow this standard structure:

**Success Response:**
\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]
}
\`\`\`

---

## Getting Started

### 1. Authenticate
Obtain access tokens by logging in with admin credentials:

\`\`\`bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
\`\`\`

### 2. Use Bearer Token
Include the access token in the Authorization header for all protected endpoints:

\`\`\`bash
Authorization: Bearer {your_access_token}
\`\`\`

### 3. Explore Endpoints
Use the sections below to explore available endpoints. Click "Authorize" button to save your token for easy testing.

---

## Support

For technical assistance or questions, contact the development team.

---

## 🔗 Quick Links

- **API Base URL:** [http://localhost:3000/api](http://localhost:3000/api)
- **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
- **Metrics:** [http://localhost:3000/metrics](http://localhost:3000/metrics)
      `,
      contact: {
        name: 'Backend Development Team',
        email: 'admin@kampus.edu'
      },
      license: {
        name: 'MIT License',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server'
      },
      {
        url: 'http://localhost:3000/api',
        description: 'API Base URL'
      },
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server (dynamic port)',
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
        description: 'User login, token refresh, and logout operations. JWT-based authentication with Bearer tokens.'
      },
      {
        name: 'Attendance',
        description: 'Fingerprint attendance operations - check in/out, view records, and attendance management'
      },
      {
        name: 'Attendance Summary',
        description: 'Attendance analytics, statistics, and summary reports with percentage calculations'
      },
      {
        name: 'Dashboard',
        description: 'Real-time dashboard statistics, trends, and key performance metrics'
      },
      {
        name: 'Export',
        description: 'Export attendance data in multiple formats (Excel, CSV, PDF)'
      },
      {
        name: 'Admin',
        description: 'Admin user management - view, create, update admin accounts'
      },
      {
        name: 'Device',
        description: 'ADMS fingerprint device management and synchronization'
      },
      {
        name: 'System',
        description: 'Health checks, monitoring, and system metrics'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from login endpoint'
        },
      },
      schemas: {
        // ==================== EMPLOYEE ====================
        Employee: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique employee ID',
              example: 1
            },
            nip: {
              type: 'string',
              description: 'Nomor Induk Pegawai (unique)',
              example: '199001012020011001'
            },
            nama: {
              type: 'string',
              description: 'Full name',
              example: 'Dr. Budi Santoso, M.Kom'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Position type',
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
              description: 'Shift assignment (NULL for DOSEN - flexible schedule)',
              example: 1
            },
            status: {
              type: 'string',
              enum: ['AKTIF', 'CUTI', 'RESIGN', 'NON_AKTIF'],
              description: 'Employment status',
              example: 'AKTIF'
            },
            tanggal_masuk: {
              type: 'string',
              format: 'date',
              description: 'Join date',
              example: '2020-01-01'
            },
            is_active: {
              type: 'boolean',
              description: 'Active status',
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
              description: 'Shift name',
              example: 'Shift Pagi'
            },
            jam_masuk: {
              type: 'string',
              format: 'time',
              description: 'Expected check-in time',
              example: '08:00:00'
            },
            toleransi_menit: {
              type: 'integer',
              description: 'Grace period in minutes',
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
              description: 'Attendance record ID',
              example: 1234
            },
            cloud_id: {
              type: 'string',
              description: 'Cloud system identifier',
              example: 'CLOUD-001'
            },
            device_id: {
              type: 'string',
              description: 'Fingerprint device ID',
              example: 'FP-DEVICE-01'
            },
            user_id: {
              type: 'string',
              description: 'User identifier from device',
              example: 'USER-001'
            },
            nama: {
              type: 'string',
              description: 'Employee name',
              example: 'Budi Santoso'
            },
            nip: {
              type: 'string',
              description: 'NIP (Employee number)',
              example: '199001012020011001'
            },
            jabatan: {
              type: 'string',
              enum: ['DOSEN', 'KARYAWAN'],
              description: 'Position',
              example: 'KARYAWAN'
            },
            tanggal_absensi: {
              type: 'string',
              format: 'date',
              description: 'Attendance date (YYYY-MM-DD)',
              example: '2026-01-14'
            },
            waktu_absensi: {
              type: 'string',
              format: 'time',
              description: 'Attendance time (HH:mm:ss)',
              example: '08:15:30'
            },
            tipe_absensi: {
              type: 'string',
              enum: ['MASUK', 'PULANG'],
              description: 'Check-in or check-out',
              example: 'MASUK'
            },
            verifikasi: {
              type: 'string',
              description: 'Verification method',
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
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Admin username',
              example: 'admin'
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
    security: [{
      bearerAuth: []
    }],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
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