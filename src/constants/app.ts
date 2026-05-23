/**
 * src/constants/app.ts — Application-wide typed constants
 *
 * Using `as const` to produce literal types instead of widened number/string types.
 * This allows TypeScript to narrow types in switch/if statements, e.g.:
 *   const status: keyof typeof HTTP_STATUS = 'OK' → inferred as 200, not number.
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;

export const JABATAN = {
  DOSEN: 'DOSEN',
  KARYAWAN: 'KARYAWAN',
} as const;

export const ATTENDANCE_STATUS = {
  HADIR: 'HADIR',
  SAKIT: 'SAKIT',
  IZIN: 'IZIN',
  ALFA: 'ALFA',
} as const;

export const EMPLOYEE_STATUS = {
  AKTIF: 'AKTIF',
  CUTI: 'CUTI',
  RESIGN: 'RESIGN',
  NON_AKTIF: 'NON_AKTIF',
} as const;

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_NAME_LENGTH: 255,
  MAX_EMAIL_LENGTH: 100,
  MIN_PAGE: 1,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  MIN_NIP_LENGTH: 10,
  MAX_NIP_LENGTH: 50,
} as const;

export const TOKEN = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
} as const;

export const EXPORT_FORMAT = {
  EXCEL: 'excel',
  CSV: 'csv',
  PDF: 'pdf',
} as const;

export const DEFAULT_SHIFTS = {
  MORNING: '08:00:00',
  NIGHT: '16:00:00',
} as const;

// Derived types for use in function signatures
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type JabatanType = (typeof JABATAN)[keyof typeof JABATAN];
export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];
