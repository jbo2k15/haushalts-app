import { test, expect } from '@playwright/test'
import { EMAIL, PASSWORD, attachErrorCollector } from './helpers.js'

// Named "0-..." so it runs before the other spec files (Playwright runs
// files in discovery order with workers:1/fullyParallel:false). This test
// needs the seeded e2e user's lastSeenVersion to still be unset — every
// other spec uses helpers.js's login(), which auto-dismisses the modal.

test('release notes modal shows once on first login, then stays dismissed', async ({ page }) => {
  const errors = attachErrorCollector(page)

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/')

  const modal = page.locator('[data-testid="release-notes-modal"]')
  await expect(modal).toBeVisible()

  // A brand-new user has never seen any version, so every release note up
  // to the current one is shown stacked in one go — not just the latest.
  const entryCount = await page.locator('[data-testid="release-note-entry"]').count()
  expect(entryCount).toBeGreaterThan(1)

  const seenRequest = page.waitForResponse(r => new URL(r.url()).pathname === '/api/release-notes/seen' && r.request().method() === 'PUT')
  await page.locator('[data-testid="release-notes-dismiss"]').click()
  await seenRequest
  await expect(modal).toBeHidden()

  // Reload: must not reappear now that the version is marked as seen.
  await page.reload()
  await expect(page.locator('[data-testid="task-row"]').first()).toBeVisible()
  await expect(modal).toBeHidden()

  expect(errors).toEqual([])
})
