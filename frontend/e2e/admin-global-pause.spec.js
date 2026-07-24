import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// The backend computes "today" in Europe/Berlin (see backend/src/lib/dates.js
// dateStringInBerlin), not the test runner's local timezone or UTC - use the
// same logic here so the pause range reliably covers "today" as the server
// sees it.
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

test('admin can start and end a global pause covering all tasks', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  const title = `E2E Global Pause Task ${Date.now()}`
  const from = isoDate(0)
  const to = isoDate(7)

  // New daily task, no individual pause range - only the global pause
  // should affect its visibility.
  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await page.getByLabel('Titel').fill(title)
  await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

  const row = page.locator('[data-testid="sortable-task"]', { hasText: title })
  await expect(row).toBeVisible()

  // Start the global pause via GlobalPauseCard. The "+Neue Aufgabe" form
  // auto-collapses after a successful submit (see Admin.jsx handleSubmit),
  // so the card's own two date inputs are the only ones on the page here.
  await expect(page.getByText('⏸ Alle Aufgaben pausieren')).toBeVisible()
  const pauseInputs = page.locator('input[type="date"]')
  await expect(pauseInputs).toHaveCount(2)
  await pauseInputs.nth(0).fill(from)
  await pauseInputs.nth(1).fill(to)
  await page.getByRole('button', { name: 'Pause starten' }).click()

  await expect(page.getByRole('button', { name: 'Beenden' })).toBeVisible()

  await page.goto('/')
  await expect(page.locator('[data-testid="task-row"]', { hasText: title })).toHaveCount(0)
  // A global pause also affects the seeded weekly task, so both the Täglich
  // and Wöchentlich blocks show a summary line here - .first() picks the
  // Täglich one (it renders first), which is enough to confirm the wiring.
  await expect(page.getByText(/Aufgaben pausiert/).first()).toBeVisible()

  await page.goto('/admin')
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()

  // Once ended, the "Von"/"Bis" display should be replaced by the empty
  // start-pause form (two date inputs + "Pause starten" button) again.
  await expect(page.getByRole('button', { name: 'Pause starten' })).toBeVisible()
  await expect(page.locator('input[type="date"]')).toHaveCount(2)

  await page.goto('/')
  await expect(page.locator('[data-testid="task-row"]', { hasText: title })).toBeVisible()

  // Aufräumen - andere Tests laufen gegen dieselbe geteilte DB und erwarten
  // eine feste Liste seed-basierter Aufgaben ohne globale Pause.
  await page.goto('/admin')
  await row.getByRole('button', { name: 'Löschen' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(row).toHaveCount(0)

  expect(errors).toEqual([])
})
