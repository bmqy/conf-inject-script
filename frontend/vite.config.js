import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/admin': {
        target: 'https://conf-inject-script.bmqy.workers.dev', // 替换为你的 Worker 地址
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
