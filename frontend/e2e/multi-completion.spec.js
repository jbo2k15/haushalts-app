import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('daily task can be completed multiple times and undone one at a time', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  const row = page.locator('[data-testid="task-row"][data-task-title="E2E Test Task"]')
  await expect(row).toHaveAttribute('data-completed', 'false')

  async function click(locator) {
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'GET')
    await locator.click()
    await response
    await page.waitForTimeout(500) // clear TaskRow's post-click lock before the next action
  }

  // Three completions in a row.
  await click(row)
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(row).toHaveAttribute('data-count', '1')

  await click(row)
  await expect(row).toHaveAttribute('data-count', '2')
  await expect(row.getByText('×2')).toBeVisible()

  await click(row)
  await expect(row).toHaveAttribute('data-count', '3')
  await expect(row.getByText('×3')).toBeVisible()

  // Undo one — still marked done (count 2), not fully reset.
  await click(row.locator('[data-testid="undo-completion"]'))
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(row).toHaveAttribute('data-count', '2')

  // Undo the remaining two — back to fully open.
  await click(row.locator('[data-testid="undo-completion"]'))
  await click(row.locator('[data-testid="undo-completion"]'))
  await expect(row).toHaveAttribute('data-completed', 'false')
  await expect(row).toHaveAttribute('data-count', '0')

  // Undo button must be gone once back to zero (nothing left to take back).
  await expect(row.locator('[data-testid="undo-completion"]')).toHaveCount(0)

  expect(errors).toEqual([])
})
