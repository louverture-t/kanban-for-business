import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'client/src'),
      '@server': path.resolve(__dirname, 'server'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/graphql': 'http://localhost:3003',
      '/api': 'http://localhost:3003',
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
});
