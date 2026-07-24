import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Die Bottom-Nav (BottomNav.jsx, Redesign Phase 3) ist der einheitliche
// Navigationsweg zu allen vier Zielen und ersetzt das frühere Header-Menü.
// Aufgaben/Ruhmeshalle sind Carousel-Slides (replace), Verwaltung/Einstellungen
// eigene Routen (push).

test('bottom nav reaches every destination and highlights the active tab', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-testid="nav-home"]')).toHaveAttribute('aria-current', 'page')

  await page.locator('[data-testid="nav-settings"]').click()
  await expect(page).toHaveURL('/settings')
  await expect(page.locator('[data-testid="nav-settings"]')).toHaveAttribute('aria-current', 'page')

  await page.locator('[data-testid="nav-hall-of-fame"]').click()
  await expect(page).toHaveURL(/\/hall-of-fame/)
  await expect(page.locator('[data-testid="nav-hall-of-fame"]')).toHaveAttribute('aria-current', 'page')

  await page.locator('[data-testid="nav-admin"]').click()
  await expect(page).toHaveURL('/admin')
  await expect(page.locator('[data-testid="nav-admin"]')).toHaveAttribute('aria-current', 'page')

  await page.locator('[data-testid="nav-home"]').click()
  await expect(page).toHaveURL('/')

  expect(errors).toEqual([])
})

test('the Verwaltung tab is hidden for non-admin users', async ({ page }) => {
  const errors = attachErrorCollector(page)
  // e2e-settings@example.com is a plain (non-admin) seeded user.
  await login(page, { email: 'e2e-settings@example.com', password: 'E2eSettings1234!' })

  await expect(page.locator('[data-testid="nav-home"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible()
  await expect(page.locator('[data-testid="nav-admin"]')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('browser back from Settings/Admin returns to the tasks tab', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.locator('[data-testid="nav-settings"]').click()
  await expect(page).toHaveURL('/settings')
  // Vor goBack auf das Carousel-Unmount warten (siehe header-menu-Historie):
  // unter startTransition kann toHaveURL schon greifen, bevor der Exit-Guard-
  // Listener abgemeldet ist, was das Zurück sonst faelschlich abfinge.
  await expect(page.locator('[data-slide-path]')).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL('/')

  expect(errors).toEqual([])
})

test('logout from Settings returns to the login screen', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.locator('[data-testid="nav-settings"]').click()
  await expect(page).toHaveURL('/settings')
  await page.locator('[data-testid="logout"]').click()
  await expect(page).toHaveURL('/login')

  expect(errors).toEqual([])
})
