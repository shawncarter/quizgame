import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '0.0.0.0', // Listen on all network interfaces
    proxy: {
      '/socket.io': {
        target: 'http://192.168.0.87:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      '/api': {
        target: 'http://192.168.0.87:5000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
