// Shared helpers for e2e specs.
import { expect } from '@playwright/test'

export const EMAIL = 'e2e@example.com' // must match backend/scripts/e2e-seed.js
export const PASSWORD = 'E2eTest1234!'

// Collects browser console errors and uncaught page errors so tests can
// assert none occurred. A bundler swap (e.g. Vite's esbuild/Rollup ->
// Rolldown/Oxc) can silently introduce runtime issues that don't break an
// interaction outright but do surface as console/page errors.
// AuthContext probes POST /api/auth/refresh on every page load, even when no
// session exists yet — an expected, gracefully-handled 401 (see
// api/client.js), not a real problem. Chrome's devtools log this at the
// network level as a console error regardless of whether the app handles it.
const BENIGN_PATTERNS = [/Failed to load resource.*401.*auth\/refresh/i, /Failed to load resource.*401 \(Unauthorized\)/i]

export function attachErrorCollector(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() !== 'error') return
    if (BENIGN_PATTERNS.some(p => p.test(msg.text()))) return
    errors.push(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', err => {
    errors.push(`pageerror: ${err.message}`)
  })
  return errors
}

export async function login(page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/')

  // A fresh e2e user has no lastSeenVersion, so the release notes modal
  // pops up on first login whenever backend/src/data/release-notes.json has
  // an entry for the current version — dismiss it so it doesn't block
  // clicks in tests that don't care about it.
  const modal = page.locator('[data-testid="release-notes-modal"]')
  if (await modal.isVisible().catch(() => false)) {
    await page.locator('[data-testid="release-notes-dismiss"]').click()
    await expect(modal).toBeHidden()
  }
}
