import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: {},
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:7070',
        // Keycloak serves its endpoints under the same /auth context path.
        headers: {
          'X-Forwarded-Host': 'localhost:5173',
          'X-Forwarded-Port': '5173',
          'X-Forwarded-Prefix': '/auth',
          'X-Forwarded-Proto': 'http',
        },
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      }
    }
  }
})
