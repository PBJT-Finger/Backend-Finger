import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface UserTokenPayload {
  id: number;
  username: string;
  role: string;
}

const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET as string;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET as string;
const JWT_ACCESS_EXPIRES_IN = '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

// Generate Access Token
export const generateAccessToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api',
  });
};

// Generate Refresh Token
export const generateRefreshToken = (payload: UserTokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api',
  });
};

// Verify Access Token
export const verifyAccessToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api',
    }) as unknown as UserTokenPayload;
  } catch (_error) {
    throw new Error('Invalid or expired access token');
  }
};

// Verify Refresh Token
export const verifyRefreshToken = (token: string): UserTokenPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api',
    }) as unknown as UserTokenPayload;
  } catch (_error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Generate token pair
 
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
