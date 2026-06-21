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
        // DB 저장(database.json 기록) 시 Vite가 전체 페이지를 새로고침하지 않도록 감시 제외
        ignored: ['**/database.json', '**/data/**'],
      },
    },
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
    },
  };
});
