// Runs synchronously before the e2e backend server starts (see
// frontend/playwright.config.js webServer command): reset the throwaway
// e2e.db, push the schema, then seed it. Kept as one sequential script so
// Playwright's webServer can't race a concurrent globalSetup against the
// server process touching the same file.
import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

if (existsSync('./e2e.db')) unlinkSync('./e2e.db')
if (existsSync('./e2e-emails.jsonl')) unlinkSync('./e2e-emails.jsonl')

execSync('npx prisma db push --force-reset --url file:./e2e.db', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test', PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'ja' },
})

execSync('node scripts/e2e-seed.js', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./e2e.db' },
})
