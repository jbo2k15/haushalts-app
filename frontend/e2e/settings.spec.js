import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Own account so name/vacation changes here can't leak into other specs
// (e.g. the name shows up in StatsSection on Home) - must match
// backend/scripts/e2e-seed.js.
const SETTINGS_EMAIL = 'e2e-settings@example.com'
const SETTINGS_PASSWORD = 'E2eSettings1234!'

test('theme toggle switches the .dark class and persists across reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page, { email: SETTINGS_EMAIL, password: SETTINGS_PASSWORD })

  await page.goto('/settings')

  await page.locator('[data-testid="theme-dark"]').click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.locator('[data-testid="theme-light"]').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  // Leave it back on "system" so it doesn't affect whichever spec runs next.
  await page.locator('[data-testid="theme-system"]').click()

  expect(errors).toEqual([])
})

test('changing the display name persists across reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page, { email: SETTINGS_EMAIL, password: SETTINGS_PASSWORD })

  await page.goto('/settings')

  const nameInput = page.locator('[data-testid="name-input"]')
  await expect(nameInput).toHaveValue('E2E Settings User')

  await nameInput.fill('E2E Settings User Renamed')
  await page.locator('[data-testid="save-name"]').click()
  await expect(page.getByText('Gespeichert ✓')).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-testid="name-input"]')).toHaveValue('E2E Settings User Renamed')

  // Restore the original name for the next test run.
  await page.locator('[data-testid="name-input"]').fill('E2E Settings User')
  await page.locator('[data-testid="save-name"]').click()

  expect(errors).toEqual([])
})

test('rejects an empty display name', async ({ page }) => {
  // No attachErrorCollector here — the intentional 400 response surfaces as
  // a benign "Failed to load resource" console entry, same as the
  // auth/refresh 401 case helpers.js already special-cases.
  await login(page, { email: SETTINGS_EMAIL, password: SETTINGS_PASSWORD })

  await page.goto('/settings')
  await page.locator('[data-testid="name-input"]').fill('   ')
  await page.locator('[data-testid="save-name"]').click()
  await expect(page.getByText('Name darf nicht leer sein')).toBeVisible()
})

test('vacation mode toggle persists across reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page, { email: SETTINGS_EMAIL, password: SETTINGS_PASSWORD })

  await page.goto('/settings')

  const toggle = page.locator('[data-testid="vacation-toggle"]')
  await expect(toggle).toHaveAttribute('data-vacation-enabled', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('data-vacation-enabled', 'true')

  await page.reload()
  await expect(page.locator('[data-testid="vacation-toggle"]')).toHaveAttribute('data-vacation-enabled', 'true')

  // Reset for the next test run.
  await page.locator('[data-testid="vacation-toggle"]').click()
  await expect(page.locator('[data-testid="vacation-toggle"]')).toHaveAttribute('data-vacation-enabled', 'false')

  expect(errors).toEqual([])
})

test('notification reminder times save and persist', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page, { email: SETTINGS_EMAIL, password: SETTINGS_PASSWORD })

  await page.goto('/settings')

  await page.locator('[data-testid="daily-time"]').fill('18:30')
  await page.locator('[data-testid="weekly-day"]').selectOption('2')
  await page.locator('[data-testid="weekly-time"]').fill('07:45')
  await page.locator('[data-testid="save-notification-settings"]').click()
  await expect(page.getByText('Gespeichert ✓')).toBeVisible()

  // saveSettings navigates back to Home ~1s after a successful save.
  await page.waitForURL('/')

  await page.goto('/settings')
  await expect(page.locator('[data-testid="daily-time"]')).toHaveValue('18:30')
  await expect(page.locator('[data-testid="weekly-day"]')).toHaveValue('2')
  await expect(page.locator('[data-testid="weekly-time"]')).toHaveValue('07:45')

  expect(errors).toEqual([])
})
