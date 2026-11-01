import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { attachErrorCollector, login } from './helpers.js'

// Barrierefreiheit der Aufgabenzeile: (1) per Tastatur abhakbar, (2) der
// Zustand "heute nicht noetig" ist sichtbar, zurueckholbar und frei von
// axe-Verstoessen (Kontrast!). Beide Tests stellen den Ausgangszustand am Ende
// wieder her, da alle Specs dieselbe Seed-Datenbank nacheinander nutzen.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function tasksReload(page) {
  return page.waitForResponse(r => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'GET')
}

test('eine Aufgabe lässt sich per Tastatur abhaken und wieder zurücknehmen', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  const row = page.locator('[data-testid="task-row"][data-task-title="E2E Test Task"]')
  const checkbox = row.getByRole('checkbox', { name: 'E2E Test Task' })
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')

  await checkbox.focus()
  let reload = tasksReload(page)
  await page.keyboard.press('Space')
  await reload
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(checkbox).toHaveAttribute('aria-checked', 'true')

  await page.waitForTimeout(500) // Klick-Sperre in TaskRow (RELEASE_DELAY_MS)
  await checkbox.focus()
  reload = tasksReload(page)
  await page.keyboard.press('Enter')
  await reload
  await expect(row).toHaveAttribute('data-completed', 'false')

  expect(errors).toEqual([])
})

test('eine übersprungene Aufgabe bleibt sichtbar, ist barrierefrei und lässt sich zurückholen', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  const row = page.locator('[data-testid="task-row"][data-task-title="E2E Sort Task B"]')
  await expect(row).toHaveAttribute('data-skipped', 'false')

  let reload = tasksReload(page)
  await row.getByRole('button', { name: 'Heute nicht nötig' }).click()
  await reload
  await expect(row).toHaveAttribute('data-skipped', 'true')
  await expect(row.getByText('Heute nicht nötig')).toBeVisible()
  await expect(row.getByRole('checkbox')).toBeDisabled()

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  if (results.violations.length) console.log(JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), null, 2))
  expect(results.violations.map(v => v.id)).toEqual([])

  await page.waitForTimeout(500)
  reload = tasksReload(page)
  await row.getByRole('button', { name: 'Zurückholen' }).click()
  await reload
  await expect(row).toHaveAttribute('data-skipped', 'false')
  await expect(row.getByRole('button', { name: 'Heute nicht nötig' })).toBeVisible()

  expect(errors).toEqual([])
})
