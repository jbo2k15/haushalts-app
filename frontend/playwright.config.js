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
  // Self-contained dummy values so the e2e server doesn't depend on
  // whatever backend/.env happens to contain on this machine (push
  // notifications aren't exercised by these tests).
  VAPID_EMAIL: 'mailto:e2e@example.com',
  VAPID_PUBLIC_KEY: 'BCWQd_gapX4Ud_v3z5OGIEKPMvPRUZtFSgbZ1SIgAjTtROEyYhIQDnXitrITE0PnW4LDE7-bmtTR9UVf2H1PzE4',
  VAPID_PRIVATE_KEY: 'phYQBWDo3xBUIFXoMRIFqNNAGrS-D6NzirfmxrPPUU4',
  // Redirects password-reset/approval emails to a file instead of sending
  // real mail - see src/services/email.js. Tests read this file to get the
  // real reset link a user would click.
  EMAIL_TEST_CAPTURE_FILE: path.resolve(backendDir, 'e2e-emails.jsonl'),
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
