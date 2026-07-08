import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Home and Hall of Fame stay mounted together at all times (see
// PageCarousel.jsx), so each keeps its own HeaderMenu instance - the one on
// the inactive slide just sits scrolled off-screen, invisible/unreachable
// for a real user, but a plain page-wide selector would still match both in
// the DOM. Scope to the active slide's container to avoid a Playwright
// strict-mode "multiple elements" error.
function menuIn(page, slideContainer) {
  return {
    toggle: slideContainer.locator('[data-testid="header-menu-toggle"]'),
    menu: slideContainer.locator('[data-testid="header-menu"]'),
  }
}

// The old per-page "← Zurück" buttons on Admin/Settings/Hall of Fame were
// replaced by this shared menu (see HeaderMenu.jsx) - Home and Hall of Fame
// are also reachable by swiping, but Settings/Admin only have the menu.
test('header menu on Hall of Fame has no leftover "Zurück" button and can navigate home', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goto('/hall-of-fame')
  const slide = page.locator('[data-slide-path="/hall-of-fame"]')
  await expect(slide.getByText('Zurück', { exact: false })).toHaveCount(0)

  const { toggle, menu } = menuIn(page, slide)
  await toggle.click()
  await expect(menu).toBeVisible()

  await menu.getByRole('button', { name: 'Zur Aufgabenübersicht' }).click()
  await expect(page).toHaveURL('/')

  expect(errors).toEqual([])
})

for (const path of ['/admin', '/settings']) {
  test(`header menu on ${path} has no leftover "Zurück" button and can navigate home`, async ({ page }) => {
    const errors = attachErrorCollector(page)
    await login(page)

    await page.goto(path)
    await expect(page.getByText('Zurück', { exact: false })).toHaveCount(0)

    await page.locator('[data-testid="header-menu-toggle"]').click()
    await expect(page.locator('[data-testid="header-menu"]')).toBeVisible()

    await page.getByRole('button', { name: 'Zur Aufgabenübersicht' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="header-menu"]')).toHaveCount(0)

    expect(errors).toEqual([])
  })
}

test('header menu on Home navigates to Settings, Hall of Fame and Admin', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  const homeSlide = page.locator('[data-slide-path="/"]')
  const { toggle } = menuIn(page, homeSlide)

  await toggle.click()
  await homeSlide.getByRole('button', { name: 'Einstellungen' }).click()
  await expect(page).toHaveURL('/settings')

  // Settings isn't part of the carousel, so its menu is a single top-level instance.
  await page.locator('[data-testid="header-menu-toggle"]').click()
  await page.getByRole('button', { name: 'Ruhmeshalle' }).click()
  await expect(page).toHaveURL(/\/hall-of-fame/)

  await menuIn(page, page.locator('[data-slide-path="/hall-of-fame"]')).toggle.click()
  await page.locator('[data-slide-path="/hall-of-fame"]').getByRole('button', { name: 'Verwaltung' }).click()
  await expect(page).toHaveURL('/admin')

  expect(errors).toEqual([])
})
