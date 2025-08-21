import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/s3_downloads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3_downloads/, '/s3_downloads')
      }
    }
  },
  resolve: {
    alias: {
      events: 'events'
    }
  }
})
