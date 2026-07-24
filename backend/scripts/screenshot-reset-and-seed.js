// Analog zu e2e-reset-and-seed.js, aber für die Screenshot-Aufnahme: eigene
// Wegwerf-DB (screenshot.db), damit die E2E-DB unberührt bleibt. Setzt die DB
// zurück, pusht das Schema und befüllt sie mit vorzeigbaren Inhalten
// (screenshot-seed.js).
import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

if (existsSync('./screenshot.db')) unlinkSync('./screenshot.db')

execSync('npx prisma db push --force-reset --url file:./screenshot.db', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'ja' },
})

execSync('node scripts/screenshot-seed.js', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./screenshot.db' },
})
