import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Every restaurant iPad runs iOS 15 — keep JS and CSS output within Safari 15.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    host: true,
    proxy: { '/api': 'http://127.0.0.1:8010', '/django-admin': 'http://127.0.0.1:8010' },
  },
  build: {
    target: ['es2020', 'safari15'],
    cssTarget: ['safari15'],
  },
})
