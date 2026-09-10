import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { login } from './helpers.js'

// Automatisiertes Barrierefreiheits-Audit (Redesign Phase 4). Scannt die
// zentralen Screens mit axe-core gegen die WCAG-2.0/2.1-A/AA-Regeln. Läuft im
// normalen E2E-Harness und damit auch in der CI, ist also wiederholbar statt
// einmalig. Findet axe einen Verstoß, listet die Konsole ihn samt Selektor auf,
// bevor der Test scheitert.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function auditViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  if (results.violations.length > 0) {
    // Kompakte, lesbare Ausgabe: was, wie schwer, wo.
    const detail = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map(n => n.target),
    }))
    console.log('axe violations:\n' + JSON.stringify(detail, null, 2))
  }
  return results.violations.map(v => v.id)
}

test('Login-Seite ist frei von axe-Verstößen', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  expect(await auditViolations(page)).toEqual([])
})

test('Aufgaben (Home) ist frei von axe-Verstößen', async ({ page }) => {
  await login(page)
  await expect(page.locator('[data-testid="nav-home"]')).toHaveAttribute('aria-current', 'page')
  expect(await auditViolations(page)).toEqual([])
})

test('Ruhmeshalle ist frei von axe-Verstößen', async ({ page }) => {
  await login(page)
  await page.locator('[data-testid="nav-hall-of-fame"]').click()
  await expect(page).toHaveURL(/hall-of-fame/)
  await expect(page.getByRole('heading', { name: 'Ruhmeshalle' })).toBeVisible()
  // Erst scannen, wenn die von /tasks/stats abhängigen Abschnitte (Rangliste
  // bzw. "Noch keine Pokale") gerendert sind — sonst prüft axe eine noch
  // unvollständige Seite. Der E2E-Seed-Nutzer hat keine Pokale.
  await expect(page.locator('[data-testid="hof-no-trophies-row"]').first()).toBeVisible()
  expect(await auditViolations(page)).toEqual([])
})

test('Einstellungen ist frei von axe-Verstößen', async ({ page }) => {
  await login(page)
  await page.locator('[data-testid="nav-settings"]').click()
  await expect(page).toHaveURL('/settings')
  expect(await auditViolations(page)).toEqual([])
})

test('Verwaltung ist frei von axe-Verstößen', async ({ page }) => {
  // E2E-Standarduser ist Admin -> Verwaltung erreichbar.
  await login(page)
  await page.locator('[data-testid="nav-admin"]').click()
  await expect(page).toHaveURL('/admin')
  expect(await auditViolations(page)).toEqual([])

  // Auch das (per Default eingeklappte) Aufgabenformular scannen — dessen
  // Felder sind sonst nicht abgedeckt.
  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await expect(page.locator('#task-title')).toBeVisible()
  expect(await auditViolations(page)).toEqual([])
})

test('Vorrat ist frei von axe-Verstößen', async ({ page }) => {
  // E2E-Standarduser ist Admin -> auch Lagerort-Verwaltung (Anlegen/
  // Umbenennen/Löschen) erreichbar.
  await login(page)
  await page.locator('[data-testid="nav-storage"]').click()
  await expect(page).toHaveURL('/storage')
  await expect(page.getByRole('heading', { name: 'Vorrat' })).toBeVisible()
  expect(await auditViolations(page)).toEqual([])

  // Lagerort anlegen und wieder umbenennen, um auch das Rename-Formular
  // (nur bei existierendem Lagerort erreichbar) und das Kategorie-Formular
  // abzudecken.
  await page.getByRole('button', { name: '+ Lagerort' }).click()
  await page.getByPlaceholder('Name des Lagerorts').fill('A11y-Testort')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByText('A11y-Testort')).toBeVisible()
  expect(await auditViolations(page)).toEqual([])

  await page.getByRole('button', { name: 'Bearb.' }).first().click()
  await expect(page.getByLabel('Name des Lagerorts')).toBeVisible()
  expect(await auditViolations(page)).toEqual([])

  // Umbenennen-Formular wieder schließen (kein Cancel-Button, nur Submit),
  // sonst bleibt "Löschen" für den folgenden Aufräumschritt unerreichbar.
  await page.getByRole('button', { name: 'OK' }).click()

  await page.getByRole('button', { name: '+ Kategorie' }).click()
  await page.getByPlaceholder('Name der Kategorie').fill('A11y-Testkategorie')
  await page.getByRole('button', { name: 'Anlegen' }).click()
  await expect(page.getByText('A11y-Testkategorie')).toBeVisible()
  expect(await auditViolations(page)).toEqual([])

  // Aufräumen: sonst bleibt der Testort für nachfolgende Storage-Tests im
  // selben Testlauf bestehen und macht z. B. "+ Kategorie" mehrdeutig.
  await page.getByRole('button', { name: 'Löschen' }).first().click()
  await page.getByTestId('confirm-dialog-confirm').click()
  await expect(page.getByText('A11y-Testort')).toHaveCount(0)
})
