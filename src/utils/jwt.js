// src/utils/jwt.js - Utility untuk manajemen JWT token
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Generate Access Token
const generateAccessToken = payload => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api'
  });
};

// Generate Refresh Token
const generateRefreshToken = payload => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'kampus-attendance-system',
    audience: 'kampus-api'
  });
};

// Verifikasi Access Token
const verifyAccessToken = token => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api'
    });
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

// Verify Refresh Token
const verifyRefreshToken = token => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'kampus-attendance-system',
      audience: 'kampus-api'
    });
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Generate token pair
const generateTokens = user => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return { accessToken, refreshToken };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens
};
