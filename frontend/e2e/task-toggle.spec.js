import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

test('toggling a task reflects the true server state, not a stale cached response', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  // A freshly registered service worker does NOT control the page that
  // registered it — only the NEXT navigation is controlled. The stale-cache
  // bug only manifests once the SW is actually intercepting fetches, so we
  // must reload before proceeding.
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  const row = page.locator('[data-testid="task-row"][data-task-title="E2E Test Task"]')
  await expect(row).toHaveAttribute('data-completed', 'false')

  // Click to complete, and wait for the GET /api/tasks that follows
  // (triggered internally by TaskRow's onToggle -> Home's loadTasks).
  const tasksReload = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'GET')
  await row.click()
  const response = await tasksReload
  const body = await response.json()
  const serverState = body.daily.find(t => t.title === 'E2E Test Task')

  // Regression guard: the response that drives the UI must reflect the
  // just-written completion, not a stale service-worker-cached snapshot
  // from before the click.
  expect(serverState.completed).toBe(true)

  // And the rendered checkbox must match — without needing a page reload.
  await expect(row).toHaveAttribute('data-completed', 'true')

  // Wait out the post-click lock (see TaskRow.jsx RELEASE_DELAY_MS) before
  // the next action, matching realistic user timing rather than a double-tap.
  await page.waitForTimeout(500)

  // Normal daily tasks (allowMultiple: false) keep the original toggle
  // behavior — clicking again un-completes it (see multi-completion.spec.js
  // for the "complete several times per day" variant).
  const tasksReloadBack = page.waitForResponse(r => new URL(r.url()).pathname === '/api/tasks' && r.request().method() === 'GET')
  await row.click()
  const responseBack = await tasksReloadBack
  const bodyBack = await responseBack.json()
  const serverStateBack = bodyBack.daily.find(t => t.title === 'E2E Test Task')
  expect(serverStateBack.completed).toBe(false)
  await expect(row).toHaveAttribute('data-completed', 'false')

  expect(errors).toEqual([])
})
