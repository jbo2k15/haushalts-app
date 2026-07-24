import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('pressing Escape closes the Aufgabe-bearbeiten modal without saving changes', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  const title = `E2E Escape Task ${Date.now()}`

  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await page.getByLabel('Titel').fill(title)
  await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

  const row = page.locator('[data-testid="sortable-task"]', { hasText: title })
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Bearb.' }).click()
  const titleInput = page.getByLabel('Titel')
  await expect(titleInput).toBeVisible()
  await titleInput.fill(`${title} geändert`)

  await page.keyboard.press('Escape')
  await expect(titleInput).toHaveCount(0)
  await expect(row).toContainText(title)
  await expect(row).not.toContainText('geändert')

  // Aufräumen - andere Tests laufen gegen dieselbe geteilte DB und erwarten
  // eine feste Liste seed-basierter Aufgaben.
  await row.getByRole('button', { name: 'Löschen' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(row).toHaveCount(0)

  expect(errors).toEqual([])
})
