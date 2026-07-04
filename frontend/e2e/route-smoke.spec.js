import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Every route gets its own lazy chunk (see App.jsx). A bundler change
// (minifier, module resolution, code-splitting behavior) can silently break
// one chunk while the routes actually exercised by other e2e tests
// (login, home, admin) keep working fine. Visit all of them and assert
// they render without console/page errors.

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']
const PROTECTED_ROUTES = ['/', '/settings', '/hall-of-fame', '/admin', '/change-password']

for (const route of PUBLIC_ROUTES) {
  test(`route ${route} renders without errors (unauthenticated)`, async ({ page }) => {
    const errors = attachErrorCollector(page)
    await page.goto(route)
    await expect(page.locator('body')).toBeVisible()
    // Give lazy chunks a moment to finish loading and any deferred errors to surface.
    await page.waitForTimeout(300)
    expect(errors).toEqual([])
  })
}

test('protected routes render without errors (authenticated)', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  for (const route of PROTECTED_ROUTES) {
    await page.goto(route)
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(300)
  }

  expect(errors).toEqual([])
})
