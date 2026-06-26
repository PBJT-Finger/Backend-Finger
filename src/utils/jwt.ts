// src/utils/jwt.ts
// Utilitas pembantu untuk membuat (generate) dan memverifikasi token JWT (Json Web Token)
// bagi mekanisme autentikasi user admin.

import jwt from 'jsonwebtoken';
import { env } from '../config/env'; // Pembaca variabel lingkungan (.env) ter-validasi

export interface UserTokenPayload {
  id: number;
  username: string;
  role: string;
}

const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET as string;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET as string;
const JWT_ACCESS_EXPIRES_IN = '15m'; // Token akses berumur pendek: 15 menit
const JWT_REFRESH_EXPIRES_IN = '7d'; // Token penyegar berumur panjang: 7 hari

/**
 * Membuat token akses (Access Token) JWT baru.
 */
export const generateAccessToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api',
  });
};

/**
 * Membuat token penyegar (Refresh Token) JWT baru.
 */
export const generateRefreshToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api',
  });
};

/**
 * Memverifikasi keasaman dan masa aktif token akses (Access Token).
 * @throws Error jika token tidak valid atau kadaluarsa
 */
export const verifyAccessToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api',
    }) as unknown as UserTokenPayload;
  } catch (_error) {
    throw new Error('Token akses tidak valid atau telah kadaluarsa');
  }
};

/**
 * Memverifikasi keasaman dan masa aktif token penyegar (Refresh Token).
 * @throws Error jika token tidak valid atau kadaluarsa
 */
export const verifyRefreshToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api',
    }) as unknown as UserTokenPayload;
  } catch (_error) {
    throw new Error('Token penyegar tidak valid atau telah kadaluarsa');
  }
};

/**
 * Membuat sepasang token JWT sekaligus (Access Token & Refresh Token).
 */
export const generateTokens = (user: any): { accessToken: string; refreshToken: string } => {
  const payload: UserTokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};
