import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '../backend')

const backendEnv = {
  ...process.env,
  DATABASE_URL: 'file:./e2e.db', // relative to cwd (backendDir)
  JWT_SECRET: 'e2e-test-secret-at-least-32-characters-long',
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:4173',
  PORT: '3101',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Reset+push+seed run synchronously before the server starts, all
      // within this one process — avoids racing Playwright's own lifecycle
      // management against a separate globalSetup touching the same file.
      command: 'node scripts/e2e-reset-and-seed.js && node src/index.js',
      cwd: backendDir,
      port: 3101,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173',
      cwd: __dirname,
      port: 4173,
      env: { VITE_API_PROXY_TARGET: 'http://localhost:3101' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
