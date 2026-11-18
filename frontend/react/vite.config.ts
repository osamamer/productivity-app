import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Production images pass APP_VERSION; local and desktop builds resolve it from VERSION and git.
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    const script = fileURLToPath(new URL('../../scripts/resolve-version.sh', import.meta.url))
    return execFileSync('bash', [script], { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: {},
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
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
