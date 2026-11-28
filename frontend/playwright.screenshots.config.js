import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

// Separate Playwright-Config nur für die PWA-Install-Screenshots. Bewusst
// vom normalen E2E-Lauf getrennt (eigenes testDir e2e-screenshots/), damit
// `npm run test:e2e` sie nicht mitzieht und sie nicht in der CI läuft.
// Aufruf:  npm run screenshots
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(__dirname, '../backend')

const backendEnv = {
  ...process.env,
  DATABASE_URL: 'file:./screenshot.db',
  JWT_SECRET: 'screenshot-secret-at-least-32-characters-long',
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:4173',
  PORT: '3101',
  // Werte aus einer lokalen backend/.env neutralisieren (dotenv überschreibt
  // gesetzte Variablen nicht): keine Abrufe echter Kalender-/Wetterdaten und
  // keine echten Inhalte in den Aufnahmen.
  WASTE_ICAL_URL: '',
  DUTY_ICAL_URL: '',
  DUTY_DONE_URL: '',
  WEATHER_LAT: '',
  WEATHER_LON: '',
  // Wegwerf-Dummy-Werte, s. playwright.config.js — Push/Mail werden hier
  // nicht ausgeübt.
  VAPID_EMAIL: 'mailto:screenshot@example.com',
  // Wegwerf-VAPID-Keypair (identisch zu playwright.config.js) — nur damit
  // push.js beim Backend-Start setVapidDetails() nicht wirft. Kein echtes/
  // Produktions-Secret. gitleaks:allow
  VAPID_PUBLIC_KEY: 'BCGSItv4U1A-EAkl33PpH3dmm7mX5_SdBSNPlcR4rAtashbqQqfA1LTgZXeY-vamwLminn_vAuf84LSb9bq2cQk', // gitleaks:allow
  VAPID_PRIVATE_KEY: 'rqniHb-bdoCv3EyI5joV7DInDpwc7O-wPGTN1ZJy9zU', // gitleaks:allow
}

export default defineConfig({
  testDir: './e2e-screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Schmales Telefon-Format für die "narrow"-Screenshots im Manifest.
    viewport: { width: 412, height: 900 },
    deviceScaleFactor: 2,
    // Deutsche Darstellung der Datumsfelder (tt.mm.jjjj statt mm/dd/yyyy).
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Die Platzhalter leerer Datumsfelder folgen der Browser-Sprache, nicht `locale`.
    launchOptions: { args: ['--lang=de-DE'] },
    // Embla liest prefers-reduced-motion und macht das scrollTo dann instant —
    // sonst würde der Ruhmeshalle-Screenshot mitten in der Wisch-Animation
    // aufgenommen (halb Home, halb Ruhmeshalle).
    reducedMotion: 'reduce',
  },
  webServer: [
    {
      command: 'node scripts/screenshot-reset-and-seed.js && node src/index.js',
      cwd: backendDir,
      port: 3101,
      env: backendEnv,
      reuseExistingServer: false,
      // Reset + Seed brauchen lokal allein rund 10 s, parallel zum Frontend-Build mehr.
      timeout: 120_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 4173',
      cwd: __dirname,
      port: 4173,
      env: { VITE_API_PROXY_TARGET: 'http://localhost:3101' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
