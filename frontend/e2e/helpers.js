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

export async function login(page, { email = EMAIL, password = PASSWORD } = {}) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)

  // Register before the click, not after waitForURL - Home mounts and fires
  // this GET as part of the same navigation, so waiting for it afterwards
  // would miss it if it already resolved.
  const notesLoaded = page.waitForResponse(r => r.url().includes('/api/release-notes') && r.request().method() === 'GET')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/')

  // A fresh e2e user has no lastSeenVersion, so the release notes modal
  // pops up on first login whenever backend/src/data/release-notes.json has
  // an entry for the current version. Check the actual response instead of
  // an instant modal.isVisible() snapshot - that races the fetch (visible()
  // isn't retried, so it can run before React even hears back) and, if lost,
  // leaves the modal to reappear later and block a subsequent hard
  // navigation (page.goto, not an in-app link) that remounts the app.
  const notesResponse = await notesLoaded
  const { notes } = await notesResponse.json().catch(() => ({ notes: [] }))
  if (notes?.length > 0) {
    const modal = page.locator('[data-testid="release-notes-modal"]')
    await expect(modal).toBeVisible()
    // dismiss() hides the modal optimistically (local state) before its PUT
    // /release-notes/seen call resolves - wait for the real response too, so
    // callers can safely hard-navigate right after login() returns.
    const seen = page.waitForResponse(r => r.url().includes('/release-notes/seen') && r.request().method() === 'PUT')
    await page.locator('[data-testid="release-notes-dismiss"]').click()
    await seen
    await expect(modal).toBeHidden()
  }
}
