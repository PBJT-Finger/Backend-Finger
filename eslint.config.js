// eslint.config.js — ESLint Flat Config (v9+), CommonJS
// Backend-Finger is a CJS project, so we use require() here
const globals = require('globals');
const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
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
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off', // Turn off base rule in favor of typescript-eslint
      '@typescript-eslint/no-explicit-any': 'off', // Downgrade any usage
      'no-async-promise-executor': 'warn',
      '@typescript-eslint/no-namespace': 'off',
      'no-console': 'off', // We use Winston for logging
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'always'],
      'no-throw-literal': 'error',
    },
    ignores: ['node_modules/**', 'prisma/generated/**', 'exports/**', 'scripts/**'],
  },
);
