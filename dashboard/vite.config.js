import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /chat and /health to the Express backend during development
      '/chat': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
})
