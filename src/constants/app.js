// src/constants/app.js - Application-wide constants

module.exports = {
  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
  },

  // User Roles
  USER_ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    OPERATOR: 'OPERATOR'
  },

  // Employee Positions
  JABATAN: {
    DOSEN: 'DOSEN',
    KARYAWAN: 'KARYAWAN'
  },

  // Attendance Types
  TIPE_ABSENSI: {
    MASUK: 'MASUK',
    PULANG: 'PULANG'
  },

  // Employee Status
  EMPLOYEE_STATUS: {
    AKTIF: 'AKTIF',
    CUTI: 'CUTI',
    RESIGN: 'RESIGN',
    NON_AKTIF: 'NON_AKTIF'
  },

  // Validation Constraints
  VALIDATION: {
    MIN_PASSWORD_LENGTH: 6,
    MAX_NAME_LENGTH: 255,
    MAX_EMAIL_LENGTH: 100,
    MIN_PAGE: 1,
    DEFAULT_PAGE_SIZE: 50,
    MAX_PAGE_SIZE: 100,
    MIN_NIP_LENGTH: 10,
    MAX_NIP_LENGTH: 50
  },

  // Token Settings
  TOKEN: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d'
  },

  // Time Formats
  TIME_FORMAT: {
    DATE: 'YYYY-MM-DD',
    TIME: 'HH:mm:ss',
    DATETIME: 'YYYY-MM-DD HH:mm:ss',
    ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ'
  },

  // Days of Week
  DAY_OF_WEEK: {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6
  },

  // Export Formats
  EXPORT_FORMAT: {
    EXCEL: 'excel',
    CSV: 'csv',
    PDF: 'pdf'
  },

  // Default Shift Times
  DEFAULT_SHIFTS: {
    MORNING: '08:00:00',
    NIGHT: '16:00:00'
  }
};
