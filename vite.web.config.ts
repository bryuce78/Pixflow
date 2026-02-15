import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_PORT = Number(process.env.PIXFLOW_WEB_API_PORT || '3002')
const API_TARGET = `http://localhost:${API_PORT}`

export default defineConfig({
  root: resolve('src/renderer'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve('dist/web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer/index.html'),
    },
  },
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
      '/avatars': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
      '/avatars_generated': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
      '/avatars_uploads': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
      '/uploads': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
      '/outputs': { target: API_TARGET, changeOrigin: true, timeout: 600_000 },
    },
  },
})
