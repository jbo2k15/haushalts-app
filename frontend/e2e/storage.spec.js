import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('Vorrat: Lagerort, Kategorie und Artikel anlegen, Menge ändern, Artikel löschen', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page) // seed-Admin, siehe helpers.js

  await page.getByTestId('nav-storage').click()
  await expect(page).toHaveURL('/storage')
  await expect(page.getByRole('heading', { name: 'Vorrat' })).toBeVisible()

  // Lagerort anlegen (Admin-only)
  await page.getByRole('button', { name: '+ Lagerort' }).click()
  await page.getByPlaceholder('Name des Lagerorts').fill('E2E Kühlschrank Garage')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByText('E2E Kühlschrank Garage')).toBeVisible()

  // Kategorie anlegen (offen für alle)
  await page.getByRole('button', { name: '+ Kategorie' }).click()
  await page.getByPlaceholder('Name der Kategorie').fill('E2E Konserven')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByText('E2E Konserven')).toBeVisible()

  // Artikel anlegen über das Modal
  await page.getByRole('button', { name: '+ Artikel' }).click()
  await page.getByLabel('Name').fill('E2E Tomaten')
  await page.getByLabel('Menge', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Speichern' }).click()

  const row = page.locator('[data-testid="storage-item-row"][data-item-name="E2E Tomaten"]')
  await expect(row).toBeVisible()
  await expect(row.getByTestId('item-quantity')).toHaveText('2')

  // Menge per Stepper erhöhen/verringern
  await row.getByRole('button', { name: 'Menge erhöhen' }).click()
  await expect(row.getByTestId('item-quantity')).toHaveText('3')
  await row.getByRole('button', { name: 'Menge verringern' }).click()
  await row.getByRole('button', { name: 'Menge verringern' }).click()
  await expect(row.getByTestId('item-quantity')).toHaveText('1')

  // Komplett löschen (nicht nur Menge auf 0)
  await row.getByRole('button', { name: 'E2E Tomaten löschen' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(row).toHaveCount(0)

  expect(errors).toEqual([])
})

test('Vorrat: Einkaufsliste + Home-Hinweis bei knappem Bestand', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.getByTestId('nav-storage').click()
  await page.getByRole('button', { name: '+ Lagerort' }).click()
  await page.getByPlaceholder('Name des Lagerorts').fill('E2E Vorratsschrank')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await page.getByRole('button', { name: '+ Kategorie' }).click()
  await page.getByPlaceholder('Name der Kategorie').fill('E2E Backen')
  await page.getByRole('button', { name: 'Anlegen' }).click()

  // Artikel direkt mit knapper Menge (0) und expliziter Mindestmenge anlegen
  await page.getByRole('button', { name: '+ Artikel' }).click()
  await page.getByLabel('Name').fill('E2E Mehl')
  await page.getByLabel('Menge', { exact: true }).fill('0')
  await page.getByLabel('Mindestmenge').fill('2')
  await page.getByRole('button', { name: 'Speichern' }).click()

  // Erscheint in der Einkaufsliste (eigener Bereich, getrennt von der Bestandsliste)
  const shoppingRow = page.locator('[data-testid="shopping-list-row"][data-item-name="E2E Mehl"]')
  await expect(shoppingRow).toBeVisible()

  // Home zeigt den Hinweis-Banner und führt zurück zum Vorrat-Tab
  await page.getByTestId('nav-home').click()
  await expect(page).toHaveURL('/')
  const banner = page.getByRole('button', { name: /Artikel im Vorrat (ist|sind) knapp/ })
  await expect(banner).toBeVisible()
  await banner.click()
  await expect(page).toHaveURL('/storage')

  // Abhaken hebt die Menge auf die Mindestmenge an, statt zu löschen
  await page.getByRole('button', { name: 'E2E Mehl als eingekauft markieren' }).click()
  await expect(shoppingRow).toHaveCount(0)
  const itemRow = page.locator('[data-testid="storage-item-row"][data-item-name="E2E Mehl"]')
  await expect(itemRow.getByTestId('item-quantity')).toHaveText('3') // Mindestmenge(2) + 1

  expect(errors).toEqual([])
})
