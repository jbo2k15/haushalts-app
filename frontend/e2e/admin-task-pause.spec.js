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

test('admin can set an individual pause period on a task and clear it again', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  const title = `E2E Pause Task ${Date.now()}`
  const from = isoDate(0)
  const to = isoDate(7)

  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await page.getByLabel('Titel').fill(title)

  // Type defaults to "Täglich" (!= 'once'), so the pause-range fields are
  // visible right away and are the only date inputs in this form.
  const newTaskForm = page.locator('form', { has: page.getByRole('button', { name: 'Aufgabe erstellen' }) })
  const pauseInputs = newTaskForm.locator('input[type="date"]')
  await expect(pauseInputs).toHaveCount(2)
  await pauseInputs.nth(0).fill(from)
  await pauseInputs.nth(1).fill(to)

  await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

  const row = page.locator('[data-testid="sortable-task"]', { hasText: title })
  await expect(row).toBeVisible()

  // Home: paused task must not appear in today's overview, and the daily
  // block's collective "paused" line must be visible instead.
  await page.goto('/')
  await expect(page.locator('[data-testid="task-row"]', { hasText: title })).toHaveCount(0)
  // .first() - the Täglich block's own summary line (there could be more
  // than one matching block if other pause-affecting state exists).
  await expect(page.getByText(/Aufgaben pausiert/).first()).toBeVisible()

  // Clear the pause range again via the edit modal.
  await page.goto('/admin')
  await row.getByRole('button', { name: 'Bearb.' }).click()
  const editModal = page.locator('form', { has: page.getByRole('button', { name: 'Speichern' }) })
  const editPauseInputs = editModal.locator('input[type="date"]')
  await expect(editPauseInputs).toHaveCount(2)
  await expect(editPauseInputs.nth(0)).toHaveValue(from)
  await expect(editPauseInputs.nth(1)).toHaveValue(to)
  await editPauseInputs.nth(0).fill('')
  await editPauseInputs.nth(1).fill('')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(editModal).toHaveCount(0)

  // Home: task must be back in the overview now that the pause is cleared.
  await page.goto('/')
  await expect(page.locator('[data-testid="task-row"]', { hasText: title })).toBeVisible()

  // Aufräumen - andere Tests (z.B. drag-drop-reorder) erwarten eine feste
  // Liste seed-basierter Aufgaben und laufen gegen dieselbe geteilte DB.
  await page.goto('/admin')
  page.once('dialog', dialog => dialog.accept())
  await row.getByRole('button', { name: 'Löschen' }).click()
  await expect(row).toHaveCount(0)

  expect(errors).toEqual([])
})
