import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }, // keeps the port matching FRONTEND_URL (CORS)
  preview: { port: 5173, strictPort: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 700 }
})
