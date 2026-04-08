// eslint.config.js - ESLint v9+ flat config
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      '.playwright-cli/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-undef': 'off', // TypeScript handles this
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
];
