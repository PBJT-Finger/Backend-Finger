/**
 * src/config/env.ts — Environment Variable Validation (TypeScript)
 *
 * Single source of truth for all runtime configuration.
 * Uses `envalid` to validate at startup — the process will exit with a clear
 * error message if any required variable is missing or malformed.
 *
 * Why envalid over dotenv alone: dotenv just loads values as strings.
 * envalid enforces types, provides defaults, and produces descriptive errors
 * before the application can enter an inconsistent state.
 */
import dotenv from 'dotenv';
import { cleanEnv, str, port, num, bool } from 'envalid';

// Load environment variables from .env file
dotenv.config();

export const env = cleanEnv(process.env, {
  // ─── Database ────────────────────────────────────────────────────────────────
  DB_HOST: str({
    desc: 'Database host address',
    default: 'localhost',
  }),
  DB_PORT: port({
    desc: 'Database port',
    default: 3306,
  }),
  DB_NAME: str({
    desc: 'Database name',
    example: 'finger_attendance',
  }),
  DB_USERNAME: str({
    desc: 'Database username',
    example: 'finger_user',
  }),
  DB_PASSWORD: str({
    desc: 'Database password',
  }),

  // ─── JWT ─────────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: str({
    desc: 'Secret key for access token',
  }),
  JWT_REFRESH_SECRET: str({
    desc: 'Secret key for refresh token',
  }),
  JWT_ACCESS_EXPIRES_IN: str({
    desc: 'Access token expiry time',
    default: '15m',
  }),
  JWT_REFRESH_EXPIRES_IN: str({
    desc: 'Refresh token expiry time',
    default: '7d',
  }),

  // ─── Server ──────────────────────────────────────────────────────────────────
  PORT: port({
    desc: 'Server port number',
    default: 3001,
  }),
  NODE_ENV: str({
    desc: 'Node environment',
    choices: ['development', 'production', 'test'],
    default: 'development',
  }),

  // ─── Security ────────────────────────────────────────────────────────────────
  API_KEY_SECRET: str({
    desc: 'Secret for API key hashing',
  }),
  CORS_ORIGINS: str({
    desc: 'Comma-separated list of allowed CORS origins',
    default: 'http://localhost:5555,http://localhost:3000,http://localhost:3333,https://finger.pbjt.web.id,https://finger-be.pbjt.web.id',
  }),

  // ─── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: str({
    desc: 'Logging level',
    choices: ['error', 'warn', 'info', 'debug'],
    default: 'info',
  }),

  // ─── SMTP / Email ────────────────────────────────────────────────────────────
  SMTP_HOST: str({
    desc: 'SMTP host server address',
    default: 'smtp.gmail.com',
  }),
  SMTP_PORT: port({
    desc: 'SMTP port number',
    default: 587,
  }),
  SMTP_SECURE: bool({
    desc: 'Use secure connection (SSL/TLS)',
    default: false,
  }),
  SMTP_USER: str({
    desc: 'SMTP username/auth email',
    default: '',
  }),
  SMTP_PASSWORD: str({
    desc: 'SMTP authentication password',
    default: '',
  }),
  EMAIL_FROM: str({
    desc: 'Sender email address',
    default: 'noreply@fingerattendance.com',
  }),
  EMAIL_FROM_NAME: str({
    desc: 'Sender displayed name',
    default: 'Finger Attendance System',
  }),

  // ─── ZKTeco Device (Anti-Corruption Layer) ───────────────────────────────────
  FINGERPRINT_IP: str({
    desc: 'IP address of the ZKTeco biometric device on the local network. Must be set in .env — no default allowed.',
  }),
  FINGERPRINT_PORT: port({
    desc: 'UDP port of the ZKTeco device (ZKTeco proprietary protocol)',
    default: 4370,
  }),
  FINGERPRINT_TIMEOUT: num({
    desc: 'Socket connection timeout in milliseconds',
    default: 10_000,
  }),
  POLLING_INTERVAL_MS: num({
    desc: 'Interval between each ZK device polling cycle in milliseconds',
    default: 2_000,
  }),
  RECONNECT_DELAY_MS: num({
    desc: 'Delay before reconnect attempt after a failed poll cycle in milliseconds',
    default: 8_000,
  }),
  IN_PORT_TIMEOUT_MS: num({
    desc: 'Internal ZKLib in-port timeout in milliseconds',
    default: 4_000,
  }),
});

/**
 * Typed interface exported for consumers that need explicit typings.
 * Prefer importing `env` directly for most use cases.
 */
export type AppEnv = typeof env;
