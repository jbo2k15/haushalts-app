import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// WEATHER_LAT/WEATHER_LON sind im E2E-Backend nicht gesetzt, daher zeigt die
// Karte deterministisch den "nicht konfiguriert"-Zustand - das reicht, um die
// Verdrahtung (Admin -> GET /api/weather/status -> Anzeige) abzudecken, ohne
// echte Open-Meteo-Aufrufe zu benötigen.
test('admin sees the weather status card in its "not configured" state', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  await expect(page.getByText('☔ Wetter-Status')).toBeVisible()
  await expect(page.getByText('Nicht konfiguriert', { exact: false })).toBeVisible()

  expect(errors).toEqual([])
})
