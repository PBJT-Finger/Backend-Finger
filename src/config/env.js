// src/config/env.js - Environment Variable Validation
const { cleanEnv, str, port } = require('envalid');

/**
 * Validate and clean environment variables
 * Throws error if required variables are missing or invalid
 */
const validateEnv = () => {
  return cleanEnv(process.env, {
    // Database Configuration
    DB_HOST: str({
      desc: 'Database host address',
      default: 'localhost'
    }),
    DB_PORT: port({
      desc: 'Database port',
      default: 3306
    }),
    DB_NAME: str({
      desc: 'Database name',
      example: 'finger_attendance'
    }),
    DB_USERNAME: str({
      desc: 'Database username',
      example: 'finger_user'
    }),
    DB_PASSWORD: str({
      desc: 'Database password'
    }),

    // JWT Configuration
    JWT_ACCESS_SECRET: str({
      desc: 'Secret key for access token',
      minLength: 32
    }),
    JWT_REFRESH_SECRET: str({
      desc: 'Secret key for refresh token',
      minLength: 32
    }),
    JWT_ACCESS_EXPIRES_IN: str({
      desc: 'Access token expiry time',
      default: '15m'
    }),
    JWT_REFRESH_EXPIRES_IN: str({
      desc: 'Refresh token expiry time',
      default: '7d'
    }),

    // Server Configuration
    PORT: port({
      desc: 'Server port number',
      default: 3333
    }),
    NODE_ENV: str({
      desc: 'Node environment',
      choices: ['development', 'production', 'test'],
      default: 'development'
    }),

    // Security Configuration
    API_KEY_SECRET: str({
      desc: 'Secret for API key hashing',
      minLength: 16
    }),
    CORS_ORIGINS: str({
      desc: 'Comma-separated list of allowed CORS origins',
      default: 'http://localhost:3000,http://localhost:3333'
    }),

    // Logging
    LOG_LEVEL: str({
      desc: 'Logging level',
      choices: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    })
  });
};

module.exports = { validateEnv };
