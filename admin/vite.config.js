import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    open: true,
    proxy: {
      // backend admin endpoints (e.g. Jotform import) run on the Node server
      '/api': { target: 'http://localhost:5050', changeOrigin: true },
    },
  },
})
