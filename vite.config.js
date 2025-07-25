import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure: (proxy, options) => {
          // 如果本地没有运行 wrangler，显示友好的错误信息
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
            res.writeHead(500, {
              'Content-Type': 'application/json',
            });
            res.end(JSON.stringify({
              error: 'API 服务不可用',
              message: '请确保已运行 "npm run dev:api" 启动后端服务'
            }));
          });
        }
      }
    }
  }
})