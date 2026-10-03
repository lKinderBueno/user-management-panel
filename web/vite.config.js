import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTimestamp = Math.floor(Date.now() / 1000).toString()

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generate-build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build',
          source: buildTimestamp,
        })
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/build' || req.url?.startsWith('/build?')) {
            res.setHeader('Content-Type', 'text/plain')
            res.end(buildTimestamp)
            return
          }
          next()
        })
      },
    },
  ],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
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
