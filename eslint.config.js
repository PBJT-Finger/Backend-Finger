const globals = require('globals');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    }
  },
  {
    files: ['src/**/*.js', '*.js'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'prefer-const': 'warn'
    }
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
  }
];
