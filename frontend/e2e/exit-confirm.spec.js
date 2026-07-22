import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test.afterEach(async ({ page }) => {
  // The "don't ask again" preference is per-browser localStorage, not tied to
  // the seeded e2e user - clear it so later tests in the same run start with
  // the confirmation enabled again (its default).
  await page.evaluate(() => localStorage.removeItem('hideExitConfirm'))
})

test('back button on Home shows an exit-confirmation modal instead of leaving immediately', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goBack()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toBeVisible()
  await expect(page).toHaveURL('/')

  expect(errors).toEqual([])
})

test('cancelling the exit-confirmation keeps the app open and asks again on the next back-press', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goBack()
  await page.locator('[data-testid="exit-confirm-cancel"]').click()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toHaveCount(0)
  await expect(page).toHaveURL('/')

  await page.goBack()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toBeVisible()

  expect(errors).toEqual([])
})

test('confirming exit stops asking again for the rest of the session', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goBack()
  await page.locator('[data-testid="exit-confirm-confirm"]').click()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toHaveCount(0)

  // A further back-press must not show the modal again within this session,
  // even though "nicht mehr fragen" wasn't checked.
  await page.goBack()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('"nicht mehr fragen" persists across a reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goBack()
  await page.locator('[data-testid="exit-confirm-dont-ask-again"]').check()
  await page.locator('[data-testid="exit-confirm-confirm"]').click()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('[data-testid="page-carousel"]')).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('Settings toggle re-enables the exit-confirmation after "nicht mehr fragen" was set', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.evaluate(() => localStorage.setItem('hideExitConfirm', 'true'))
  await page.goto('/settings')

  const toggle = page.locator('[data-testid="exit-confirm-toggle"]')
  await expect(toggle).toHaveAttribute('data-exit-confirm-enabled', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-exit-confirm-enabled', 'true')

  await page.goto('/')
  await expect(page.locator('[data-testid="page-carousel"]')).toBeVisible()
  await page.goBack()
  await expect(page.locator('[data-testid="exit-confirm-modal"]')).toBeVisible()

  expect(errors).toEqual([])
})
