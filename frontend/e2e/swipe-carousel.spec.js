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

test('each slide scrolls independently and Hall of Fame is not stretched to the height of a scrolled Home page', async ({ page }) => {
  const errors = attachErrorCollector(page)
  // A small viewport guarantees Home's content overflows even with the
  // modest seeded task list, without depending on exactly how much content
  // exists.
  await page.setViewportSize({ width: 400, height: 500 })
  await login(page)

  const homeScroll = page.locator('[data-testid="carousel-slide-scroll"][data-slide-path="/"]')
  const hofScroll = page.locator('[data-testid="carousel-slide-scroll"][data-slide-path="/hall-of-fame"]')

  // Simulate having scrolled deep into a long task list on Home - before the
  // fix, both slides shared one page-level scroll, so a deep scroll here
  // would land on a visually "empty" area of Hall of Fame after swiping,
  // because Hall of Fame's short content got stretched to Home's height.
  await homeScroll.evaluate(el => { el.scrollTop = el.scrollHeight })
  const scrolledTo = await homeScroll.evaluate(el => el.scrollTop)
  expect(scrolledTo).toBeGreaterThan(0)

  await dragCarousel(page, { fromX: 300, toX: 100 })
  await expect(page).toHaveURL(/\/hall-of-fame/)

  // Hall of Fame's own scroll container starts at the top regardless of
  // Home's scroll position, and its content (heading) is immediately
  // visible without needing to scroll first.
  await expect(hofScroll.evaluate(el => el.scrollTop)).resolves.toBe(0)
  await expect(page.getByText('Ruhmeshalle').first()).toBeInViewport()

  // Swiping back to Home restores exactly where it was left off.
  await dragCarousel(page, { fromX: 100, toX: 300 })
  await expect(page).toHaveURL('/')
  await expect.poll(() => homeScroll.evaluate(el => el.scrollTop)).toBe(scrolledTo)

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
