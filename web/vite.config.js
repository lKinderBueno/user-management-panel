import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/player_api.php': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/get.php': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
