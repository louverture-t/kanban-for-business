import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'client/src'),
      '@server': path.resolve(__dirname, 'server'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/__tests__/**/*.test.ts'],
          setupFiles: ['server/__tests__/setup.ts'],
        },
        resolve: {
          alias: {
            '@server': path.resolve(__dirname, 'server'),
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
      },
      {
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['client/src/__tests__/**/*.test.{ts,tsx}'],
          setupFiles: ['client/src/__tests__/setup.ts'],
        },
        resolve: {
          alias: {
            '@client': path.resolve(__dirname, 'client/src'),
            '@shared': path.resolve(__dirname, 'shared'),
          },
        },
      },
    ],
  },
});
