import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      watch: {
        ignored: ['**/database.json', '**/data/**', '../csb-admin/database.json'],
      },
    },
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
    },
  };
});
