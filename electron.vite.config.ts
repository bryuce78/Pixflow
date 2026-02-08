import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true, timeout: 600_000 },
        '/avatars': { target: 'http://localhost:3001', changeOrigin: true, timeout: 600_000 },
        '/uploads': { target: 'http://localhost:3001', changeOrigin: true, timeout: 600_000 },
        '/outputs': { target: 'http://localhost:3001', changeOrigin: true, timeout: 600_000 },
      },
    },
  },
})
