import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { attachErrorCollector } from './helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EMAIL_CAPTURE_FILE = path.resolve(__dirname, '../../backend/e2e-emails.jsonl')

const PWRESET_EMAIL = 'e2e-pwreset@example.com' // must match backend/scripts/e2e-seed.js
const OLD_PASSWORD = 'E2ePwReset1234!'
const NEW_PASSWORD = 'NewPwReset5678!'

// backend/src/services/email.js appends one JSON line per "sent" message
// when EMAIL_TEST_CAPTURE_FILE is set (see playwright.config.js) instead of
// going through real SMTP. Pull the real reset link a user would click out
// of the most recent matching entry.
function readLatestResetLink(email) {
  const lines = readFileSync(EMAIL_CAPTURE_FILE, 'utf8').trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const msg = JSON.parse(lines[i])
    if (msg.to !== email || msg.subject !== 'Passwort zurücksetzen') continue
    const match = msg.html.match(/href="([^"]+)"/)
    if (match) return match[1]
  }
  throw new Error(`No password-reset email found for ${email} in ${EMAIL_CAPTURE_FILE}`)
}

test('password reset: forgot-password -> real link -> new password works, old one does not', async ({ page }) => {
  const errors = attachErrorCollector(page)

  await page.goto('/forgot-password')
  await page.locator('input[type="email"]').fill(PWRESET_EMAIL)
  await page.getByRole('button', { name: 'Link senden' }).click()
  await expect(page.getByText('Falls die E-Mail-Adresse registriert ist')).toBeVisible()

  const resetLink = readLatestResetLink(PWRESET_EMAIL)
  await page.goto(resetLink)

  await page.locator('input[type="password"]').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Passwort speichern' }).click()
  await page.waitForURL('/login')

  // Old password must no longer work.
  await page.locator('input[type="email"]').fill(PWRESET_EMAIL)
  await page.locator('input[type="password"]').fill(OLD_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText('Ungültige Anmeldedaten')).toBeVisible()

  // New password logs in successfully.
  await page.locator('input[type="password"]').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/')

  expect(errors).toEqual([])
})

test('password reset: reusing a token a second time fails', async ({ page }) => {
  await page.goto('/forgot-password')
  await page.locator('input[type="email"]').fill(PWRESET_EMAIL)
  await page.getByRole('button', { name: 'Link senden' }).click()
  await expect(page.getByText('Falls die E-Mail-Adresse registriert ist')).toBeVisible()

  const resetLink = readLatestResetLink(PWRESET_EMAIL)

  // First use succeeds.
  await page.goto(resetLink)
  await page.locator('input[type="password"]').fill('FirstUse1234!')
  await page.getByRole('button', { name: 'Passwort speichern' }).click()
  await page.waitForURL('/login')

  // Second use of the exact same link must be rejected (already claimed).
  await page.goto(resetLink)
  await page.locator('input[type="password"]').fill('SecondUse5678!')
  await page.getByRole('button', { name: 'Passwort speichern' }).click()
  await expect(page.getByText('Link ungültig oder abgelaufen')).toBeVisible()
  await expect(page).toHaveURL(/\/reset-password/)
})

test('password reset: invalid token shows an error instead of succeeding', async ({ page }) => {
  await page.goto('/reset-password?token=this-token-does-not-exist')
  await page.locator('input[type="password"]').fill('SomeValid1234!')
  await page.getByRole('button', { name: 'Passwort speichern' }).click()
  await expect(page.getByText('Link ungültig oder abgelaufen')).toBeVisible()
  await expect(page).toHaveURL(/\/reset-password/)
})
