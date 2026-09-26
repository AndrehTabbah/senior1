import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-server proxy: any request to /api is forwarded to the Flask backend.
// Change the target once the backend is running on a different port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
