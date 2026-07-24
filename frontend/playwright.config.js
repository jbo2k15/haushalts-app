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
  // notifications aren't exercised by these tests). Throwaway key pair
  // generated solely for this config - never reuse a real/production VAPID
  // key here (see GitGuardian incident 2026-07-04, a prior real key was
  // accidentally committed this way).
  VAPID_EMAIL: 'mailto:e2e@example.com',
  VAPID_PUBLIC_KEY: 'BCGSItv4U1A-EAkl33PpH3dmm7mX5_SdBSNPlcR4rAtashbqQqfA1LTgZXeY-vamwLminn_vAuf84LSb9bq2cQk',
  VAPID_PRIVATE_KEY: 'rqniHb-bdoCv3EyI5joV7DInDpwc7O-wPGTN1ZJy9zU',
  // Redirects password-reset/approval emails to a file instead of sending
  // real mail - see src/services/email.js. Tests read this file to get the
  // real reset link a user would click.
  EMAIL_TEST_CAPTURE_FILE: path.resolve(backendDir, 'e2e-emails.jsonl'),
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Auf CI (langsamerer Headless-Runner) Umgebungs-Flakes abfangen - z.B. der
  // Timing-Race zwischen goBack() und dem Neu-Mounten des Exit-Guards in
  // header-menu.spec (Code, den Phase 3 ohnehin ablöst). Playwright meldet
  // erfolgreiche Wiederholungen als "flaky", maskiert also nichts; lokal 0,
  // damit Flakes sichtbar bleiben.
  retries: process.env.CI ? 2 : 0,
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
