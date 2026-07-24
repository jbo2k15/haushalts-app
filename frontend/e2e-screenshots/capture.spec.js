import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { login } from '../e2e/helpers.js'

// Nimmt die vier PWA-Install-Screenshots (manifest.screenshots) im neuen
// Design auf und legt sie in public/screenshots ab. Kein Test im engeren Sinn,
// sondern ein reproduzierbarer Aufnahme-Lauf — daher eigenes testDir +
// eigene Config (playwright.screenshots.config.js), außerhalb des CI-E2E-Laufs.
// Aufnahme im Telefon-Format (viewport, nicht fullPage): das ist die
// Above-the-fold-Ansicht inkl. Bottom-Nav, wie sie die Installations-UI zeigt.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/screenshots')

const ANNA = { email: 'anna@example.com', password: 'Screenshot1234!' }

test('Screenshots aufnehmen', async ({ page }) => {
  // Push-Prompt-Banner stummschalten: headless sind Notifications "denied",
  // was sonst ein "Push blockiert"-Banner auf dem Home-Screenshot zeigt. Der
  // pushSnoozedUntil-Key ist der reguläre "Morgen erinnern"-Zustand.
  await page.addInitScript(() => {
    localStorage.setItem('pushSnoozedUntil', String(Date.now() + 365 * 24 * 60 * 60 * 1000))
  })

  // 1) Login-Seite (vor dem Anmelden)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await page.screenshot({ path: path.join(outDir, 'login.png') })

  // 2) Aufgaben (Home)
  await login(page, ANNA)
  await expect(page.getByText('Blumen gießen').first()).toBeVisible()
  await expect(page.locator('[data-testid="nav-home"]')).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: path.join(outDir, 'home.png') })

  // 3) Ruhmeshalle
  await page.locator('[data-testid="nav-hall-of-fame"]').click()
  await expect(page.getByRole('heading', { name: 'Ruhmeshalle' })).toBeVisible()
  await expect(page.getByText('Anna').first()).toBeVisible()
  await expect(page.locator('[data-testid="nav-hall-of-fame"]')).toHaveAttribute('aria-current', 'page')
  await page.waitForTimeout(400) // Carousel-Position settlen lassen
  await page.screenshot({ path: path.join(outDir, 'halloffame.png') })

  // 4) Verwaltung (Anna ist Admin)
  await page.locator('[data-testid="nav-admin"]').click()
  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('button', { name: '+ Neue Aufgabe' })).toBeVisible()
  await page.screenshot({ path: path.join(outDir, 'admin.png') })
})
