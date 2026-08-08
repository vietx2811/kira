import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    host: host || '127.0.0.1',
    port: Number(process.env.PORT) || 5173,
    // tauri.conf.json's devUrl is a static "http://127.0.0.1:5173" — if
    // Vite silently drifted to a different port, the native webview would
    // load a blank window pointed at a dead origin. Only relax strictPort
    // when something explicitly asked for a specific PORT (e.g. a
    // browser-preview tool sharing the machine with another dev session);
    // `tauri dev` never sets PORT, so it keeps the old fail-loud-on-5173
    // behavior that matches devUrl.
    strictPort: !process.env.PORT,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
})
