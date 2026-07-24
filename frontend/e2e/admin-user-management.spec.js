import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// The e2e admin (E2E_EMAIL from helpers.js) manages three dedicated
// throwaway users seeded in backend/scripts/e2e-seed.js, kept separate from
// any account another spec logs in with.
//
// Seit dem Redesign-IA-Umbau (siehe REDESIGN.md) liegt die Nutzerverwaltung
// als admin-only Abschnitt in den Einstellungen (/settings), nicht mehr im
// Verwaltungs-Tab. Die user-row/Aktions-testids sind unverändert.

test('admin can approve and then lock a pending user', async ({ page }) => {
  const errors = attachErrorCollector(page)
  page.on('dialog', dialog => dialog.accept())
  await login(page)

  await page.goto('/settings')

  const row = page.locator('[data-testid="user-row"][data-user-email="e2e-pending@example.com"]')
  await expect(row).toHaveAttribute('data-user-approved', 'false')
  await expect(row.getByRole('button', { name: 'Freischalten' })).toBeVisible()

  await row.locator('[data-testid="toggle-approve"]').click()
  await expect(row).toHaveAttribute('data-user-approved', 'true')
  await expect(row.getByRole('button', { name: 'Sperren' })).toBeVisible()

  // Locking a previously-approved user goes through a confirm() dialog
  // (auto-accepted above) since it immediately revokes access.
  await row.locator('[data-testid="toggle-approve"]').click()
  await expect(row).toHaveAttribute('data-user-approved', 'false')
  await expect(row.getByRole('button', { name: 'Freischalten' })).toBeVisible()

  expect(errors).toEqual([])
})

test('admin can promote a user to admin and back', async ({ page }) => {
  const errors = attachErrorCollector(page)
  page.on('dialog', dialog => dialog.accept())
  await login(page)

  await page.goto('/settings')

  const row = page.locator('[data-testid="user-row"][data-user-email="e2e-plain@example.com"]')
  const adminBadge = row.locator('span', { hasText: 'Admin' }) // excludes the "↑ Admin" button (different tag)
  await expect(row).toHaveAttribute('data-user-role', 'user')
  await expect(adminBadge).toHaveCount(0)

  await row.locator('[data-testid="toggle-role"]').click()
  await expect(row).toHaveAttribute('data-user-role', 'admin')
  await expect(adminBadge).toBeVisible()

  await row.locator('[data-testid="toggle-role"]').click()
  await expect(row).toHaveAttribute('data-user-role', 'user')
  await expect(adminBadge).toHaveCount(0)

  expect(errors).toEqual([])
})

test('admin cannot see a delete button on their own row', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.goto('/settings')

  const ownRow = page.locator('[data-testid="user-row"][data-user-email="e2e@example.com"]')
  await expect(ownRow).toBeVisible()
  await expect(ownRow.locator('[data-testid="delete-user"]')).toHaveCount(0)

  expect(errors).toEqual([])
})

test('admin can permanently delete a user', async ({ page }) => {
  const errors = attachErrorCollector(page)
  page.on('dialog', dialog => dialog.accept())
  await login(page)

  await page.goto('/settings')

  const row = page.locator('[data-testid="user-row"][data-user-email="e2e-delete-me@example.com"]')
  await expect(row).toBeVisible()

  await row.locator('[data-testid="delete-user"]').click()
  await expect(row).toHaveCount(0)

  // Reload to confirm the deletion was persisted server-side, not just
  // held in local optimistic state.
  await page.reload()
  await expect(page.locator('[data-testid="user-row"][data-user-email="e2e-delete-me@example.com"]')).toHaveCount(0)

  expect(errors).toEqual([])
})
