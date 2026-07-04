import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('waste-calendar tasks are separated from manual task management in Admin', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')
  await expect(page.locator('[data-testid="sortable-task"]').first()).toBeVisible()

  // Never appear in the manually-managed, drag-and-drop-sortable list.
  await expect(page.locator('[data-testid="sortable-task"][data-task-title="E2E Waste Upcoming"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="sortable-task"][data-task-title="E2E Waste Expired"]')).toHaveCount(0)

  // Show up in the dedicated "Abfallkalender" section instead.
  const wasteSection = page.getByText('Abfallkalender').locator('../..')
  await expect(wasteSection.getByText('E2E Waste Upcoming')).toBeVisible()
  await expect(wasteSection.getByText('E2E Waste Expired')).toBeVisible()
  await expect(wasteSection.getByText('Bevorstehend', { exact: true })).toBeVisible()
  await expect(wasteSection.getByText('Abgelaufen', { exact: true })).toBeVisible()

  // Only the expired one is deletable — the upcoming one is calendar-managed.
  const upcomingRow = wasteSection.getByText('E2E Waste Upcoming').locator('../..')
  await expect(upcomingRow.getByRole('button', { name: 'Löschen' })).toHaveCount(0)

  const expiredRow = wasteSection.getByText('E2E Waste Expired').locator('../..')
  page.once('dialog', dialog => dialog.accept()) // deleteTask() uses window.confirm()
  await expiredRow.getByRole('button', { name: 'Löschen' }).click()
  await expect(wasteSection.getByText('E2E Waste Expired')).toHaveCount(0)

  expect(errors).toEqual([])
})
