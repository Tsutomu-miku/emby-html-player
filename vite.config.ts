import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  // GitHub Pages: https://Tsutomu-miku.github.io/emby-html-player/ 需要 base
  base: process.env.VITE_BASE_URL ?? '/emby-html-player/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
