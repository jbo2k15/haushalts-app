import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Embla listens to Pointer Events, so a plain mouse drag exercises the same
// code path as a touch swipe (both are just "pointer" events to the
// browser) - no touch-specific simulation needed.
async function dragCarousel(page, { fromX, toX, y = 400 }) {
  const carousel = page.locator('[data-testid="page-carousel"]')
  await carousel.waitFor({ state: 'visible' })
  await page.mouse.move(fromX, y)
  await page.mouse.down()
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, y, { steps: 1 })
  }
  await page.mouse.up()
}

test('swiping (dragging) left and right navigates between Home and Hall of Fame', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  const dots = page.locator('[data-testid="carousel-dot"]')
  await expect(dots).toHaveCount(2)
  await expect(dots.nth(0)).toHaveAttribute('data-active', 'true')
  await expect(dots.nth(1)).toHaveAttribute('data-active', 'false')
  await expect(page).toHaveURL('/')

  // Drag from right to left -> advance to the next slide (Hall of Fame).
  await dragCarousel(page, { fromX: 1000, toX: 300 })
  await expect(page).toHaveURL(/\/hall-of-fame/)
  await expect(dots.nth(1)).toHaveAttribute('data-active', 'true')
  await expect(page.getByText('Ruhmeshalle').first()).toBeVisible()

  // Drag from left to right -> back to Home.
  await dragCarousel(page, { fromX: 300, toX: 1000 })
  await expect(page).toHaveURL('/')
  await expect(dots.nth(0)).toHaveAttribute('data-active', 'true')

  expect(errors).toEqual([])
})

test('the existing "Ruhmeshalle" button still navigates and keeps the carousel in sync', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.getByRole('button', { name: '🏆 Ruhmeshalle' }).click()
  await expect(page).toHaveURL(/\/hall-of-fame/)
  await expect(page.locator('[data-testid="carousel-dot"]').nth(1)).toHaveAttribute('data-active', 'true')

  // Swiping back from here must still work after a non-swipe navigation in.
  await dragCarousel(page, { fromX: 300, toX: 1000 })
  await expect(page).toHaveURL('/')

  expect(errors).toEqual([])
})

test('a short drag that does not cross the threshold does not change the page', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await dragCarousel(page, { fromX: 700, toX: 650 })
  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-testid="carousel-dot"]').nth(0)).toHaveAttribute('data-active', 'true')

  expect(errors).toEqual([])
})

test('swipe onboarding tip shows once for a first-time user and stays dismissed after reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page, { email: 'e2e-swipe@example.com', password: 'E2eSwipe1234!' })

  await expect(page.getByText('Tipp: Wische')).toBeVisible()

  const seen = page.waitForResponse(r => r.url().includes('/users/me/swipe-tip-seen') && r.request().method() === 'PUT')
  await page.locator('[data-testid="swipe-tip-dismiss"]').click()
  await seen
  await expect(page.getByText('Tipp: Wische')).toBeHidden()

  // Persisted server-side (not just local state) - survives a hard reload.
  await page.reload()
  await expect(page.getByText('Tipp: Wische')).toHaveCount(0)

  expect(errors).toEqual([])
})
