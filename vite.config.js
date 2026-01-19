import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Development server configuration
  server: {
    port: 5173,
    proxy: {
      // Python backend (Snowflake connection, query execution, metadata)
      // Routes: /api/connect, /api/session, /api/query, /api/metadata, /api/system, /api/tenant-config
      '/api/connect': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/disconnect': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/session': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/query': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/metadata': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/system': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/tenant-config': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api/sessions': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      
      // Node.js backend (Evaluation runs, scoring, gaps, plans, artifacts)
      // Routes: /api/runs/*, /health/ready (for evaluation health check)
      '/api/runs': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Evaluation backend health check - MUST be before /health to match first
      '/health/ready': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Python backend health check - after /health/ready so it doesn't catch /health/ready
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  
  // For GitHub Pages deployment (production build)
  base: '/MDLH_Dictionary/',
})
