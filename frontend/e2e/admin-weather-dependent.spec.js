import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('admin can mark a daily task as weather-dependent and unmark it again', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  const title = `E2E Weather Task ${Date.now()}`

  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await page.getByLabel('Titel').fill(title)
  // Type defaults to "Täglich", which is required for the checkbox to appear.
  await expect(page.getByLabel('Wetterabhängig (entfällt bei Regen)')).toBeVisible()
  await page.getByLabel('Wetterabhängig (entfällt bei Regen)').check()
  await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

  const row = page.locator('[data-testid="sortable-task"]', { hasText: title })
  await expect(row).toContainText('☔ Wetterabhängig')

  await row.getByRole('button', { name: 'Bearb.' }).click()
  const modalCheckbox = page.getByLabel('Wetterabhängig (entfällt bei Regen)')
  await expect(modalCheckbox).toBeChecked()
  await modalCheckbox.uncheck()
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(row).not.toContainText('☔ Wetterabhängig')

  // Aufräumen - andere Tests (z.B. drag-drop-reorder) erwarten eine feste
  // Liste seed-basierter Aufgaben und laufen gegen dieselbe geteilte DB.
  page.once('dialog', dialog => dialog.accept())
  await row.getByRole('button', { name: 'Löschen' }).click()
  await expect(row).toHaveCount(0)

  expect(errors).toEqual([])
})
