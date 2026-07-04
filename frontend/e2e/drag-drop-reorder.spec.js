import { test, expect } from '@playwright/test'

// Must match backend/scripts/e2e-seed.js
const EMAIL = 'e2e@example.com'
const PASSWORD = 'E2eTest1234!'

async function dailyTaskTitles(page) {
  const rows = page.locator('[data-testid="sortable-task"][data-task-title^="E2E "]')
  return rows.evaluateAll(els => els.map(el => el.getAttribute('data-task-title')))
}

test('drag-and-drop reorder persists across reload', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL('/')

  await page.goto('/admin')
  await expect(page.locator('[data-testid="sortable-task"]').first()).toBeVisible()

  const before = await dailyTaskTitles(page)
  expect(before).toEqual(['E2E Test Task', 'E2E Sort Task A', 'E2E Sort Task B'])

  // Drag "E2E Sort Task B" above "E2E Test Task" using raw mouse events —
  // @dnd-kit's MouseSensor listens to native mouse events, not HTML5 dragstart,
  // so Playwright's dragTo() (which fires HTML5 drag events) won't trigger it.
  const handleB = page.locator('[data-testid="sortable-task"][data-task-title="E2E Sort Task B"] [data-testid="drag-handle"]')
  const targetRow = page.locator('[data-testid="sortable-task"][data-task-title="E2E Test Task"]')

  const handleBox = await handleB.boundingBox()
  const targetBox = await targetRow.boundingBox()

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  // Small initial move to clear @dnd-kit's activation distance threshold.
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 - 10, { steps: 5 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 2, { steps: 10 })
  await page.mouse.up()

  const reorderResponse = page.waitForResponse(r => r.url().includes('/tasks/admin/reorder') && r.request().method() === 'POST')
  await reorderResponse

  const afterDrag = await dailyTaskTitles(page)
  expect(afterDrag[0]).toBe('E2E Sort Task B')

  // Reload and confirm the new order was actually persisted server-side,
  // not just held in local optimistic state.
  await page.reload()
  await expect(page.locator('[data-testid="sortable-task"]').first()).toBeVisible()
  const afterReload = await dailyTaskTitles(page)
  expect(afterReload).toEqual(afterDrag)
})
