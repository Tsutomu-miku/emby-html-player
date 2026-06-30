import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const __dir = import.meta.dirname

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: 'electron/main/index.ts' },
      rollupOptions: {
        output: { format: 'es', entryFileNames: 'index.mjs' },
        external: ['electron'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: 'electron/preload/index.ts' },
      rollupOptions: {
        output: { format: 'es', entryFileNames: 'index.mjs' },
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: '.',
    base: './',
    resolve: {
      alias: { '@': path.resolve(__dir, './src') },
    },
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: path.resolve(__dir, 'index.html') },
    },
    server: {
      port: 5173,
      host: true,
    },
  },
})
