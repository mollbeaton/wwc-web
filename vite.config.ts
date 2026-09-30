import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dashboard talks to wwc-api. In dev we proxy /api → the local API so the
// browser makes same-origin requests and no CORS dance is needed; in prod the
// app is served from its own origin and hits the API directly via
// VITE_API_BASE_URL (see src/api/client.ts), where the API's CORS middleware
// allows it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
