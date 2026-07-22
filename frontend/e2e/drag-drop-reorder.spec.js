import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

async function dailyTaskTitles(page) {
  const rows = page.locator('[data-testid="sortable-task"][data-task-title^="E2E "]')
  return rows.evaluateAll(els => els.map(el => el.getAttribute('data-task-title')))
}

test('drag-and-drop reorder persists across reload', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  // The admin page has grown taller since GlobalPauseCard was added above
  // the sortable list (see GlobalPauseCard.jsx): "E2E Sort Task B" and
  // "E2E Test Task" no longer both fit within the default 1280x720
  // viewport. Raw page.mouse coordinates only work within the visible
  // viewport, so without extra height here the mousedown/move/up sequence
  // below silently misses the target - dnd-kit's dragged element never
  // gets the CSS transform it applies once a drag is actually active.
  await page.setViewportSize({ width: 1280, height: 1400 })

  await page.goto('/admin')
  await expect(page.locator('[data-testid="sortable-task"]').first()).toBeVisible()

  const before = await dailyTaskTitles(page)
  expect(before).toEqual(['E2E Test Task', 'E2E Sort Task A', 'E2E Sort Task B', 'E2E Multi Task', 'E2E Weekly Multi Task'])

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

  expect(errors).toEqual([])
})

test('drag-and-drop reorder still works at 130% zoom', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  // Root font-size scaling (see ZoomContext.jsx) grows the whole page, so
  // this needs an even taller viewport than the 100%-zoom test above to
  // keep both rows in view without scrolling - dnd-kit's raw mouse
  // coordinates only work within the visible viewport (see comment above).
  await page.evaluate(() => localStorage.setItem('zoom', '130'))
  await page.setViewportSize({ width: 1280, height: 1800 })

  await page.goto('/admin')
  await expect(page.locator('html')).toHaveCSS('font-size', '20.8px') // 130% of the 16px browser default
  await expect(page.locator('[data-testid="sortable-task"]').first()).toBeVisible()

  // Swap whichever two tasks currently sit first/second - independent of the
  // exact order left behind by the 100%-zoom test above, since both tests
  // share one DB across the run.
  const [firstTitle, secondTitle] = await dailyTaskTitles(page)

  const handleFirst = page.locator(`[data-testid="sortable-task"][data-task-title="${firstTitle}"] [data-testid="drag-handle"]`)
  const secondRow = page.locator(`[data-testid="sortable-task"][data-task-title="${secondTitle}"]`)

  const handleBox = await handleFirst.boundingBox()
  const targetBox = await secondRow.boundingBox()

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  // Small initial move to clear @dnd-kit's activation distance threshold.
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 10, { steps: 5 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 2, { steps: 10 })
  await page.mouse.up()

  const reorderResponse = page.waitForResponse(r => r.url().includes('/tasks/admin/reorder') && r.request().method() === 'POST')
  await reorderResponse

  const titlesAfter = await dailyTaskTitles(page)
  expect(titlesAfter[0]).toBe(secondTitle)
  expect(titlesAfter[1]).toBe(firstTitle)

  expect(errors).toEqual([])
})
