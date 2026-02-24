// eslint.config.js — ESLint Flat Config (v9+), CommonJS
// Backend-Finger is a CJS project, so we use require() here
const globals = require('globals');
const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  prettier, // Disable styling rules that conflict with Prettier
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Best practices
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off', // We use Winston for logging
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',
    },
    ignores: ['node_modules/**', 'prisma/generated/**', 'exports/**', 'scripts/**'],
  },
];
