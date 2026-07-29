import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api/* to local Azure Functions during development
      // Run: swa start  OR  func start (in /api folder) on port 7071
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      }
    }
  }
})
