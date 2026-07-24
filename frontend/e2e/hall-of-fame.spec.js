import { test, expect } from '@playwright/test'
import { attachErrorCollector, login } from './helpers.js'

// Trophy counts are computed server-side by a scheduled job from real
// TaskLog history (src/lib/trophies.js, already covered by its own Vitest
// suite) and overwritten on every backend startup - not something that can
// be seeded as fixed row data for a repeatable E2E run. This test instead
// mocks the GET /tasks/stats response to exercise the page's own
// ranking/sorting/grouping logic in isolation.
// Rank = monthTrophies*4 + weekTrophies*2 + dayTrophies:
//   Gold   -> month 2, week 1, day 0 -> score 10 -> rank 1 (🥇)
//   Silver -> month 0, week 3, day 1 -> score  7 -> rank 2 (🥈)
//   Bronze -> month 0, week 0, day 5 -> score  5 -> rank 3 (🥉)
//   None   -> no trophies -> "Noch keine Pokale" section
const MOCK_STATS = [
  { id: 'u-gold',   name: 'E2E HoF Gold',   curDay: 0, curWeek: 0, curMonth: 0, dayTrophies: 0, weekTrophies: 1, monthTrophies: 2 },
  { id: 'u-silver', name: 'E2E HoF Silver', curDay: 0, curWeek: 0, curMonth: 0, dayTrophies: 1, weekTrophies: 3, monthTrophies: 0 },
  { id: 'u-bronze', name: 'E2E HoF Bronze', curDay: 0, curWeek: 0, curMonth: 0, dayTrophies: 5, weekTrophies: 0, monthTrophies: 0 },
  { id: 'u-none',   name: 'E2E HoF None',   curDay: 0, curWeek: 0, curMonth: 0, dayTrophies: 0, weekTrophies: 0, monthTrophies: 0 },
]

test('hall of fame ranks users by trophy score and shows trophy-less users separately', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.route('**/api/tasks/stats', route => route.fulfill({ json: MOCK_STATS }))
  await page.goto('/hall-of-fame')
  // Auf die Seiten-Überschrift zeigen, nicht auf das gleichnamige Bottom-Nav-
  // Label (seit Phase 3), sonst trifft getByText zwei Elemente.
  await expect(page.getByRole('heading', { name: 'Ruhmeshalle' })).toBeVisible()

  const rankedRows = page.locator('[data-testid="hof-ranked-row"]')
  await expect(rankedRows).toHaveCount(3)

  await expect(rankedRows.nth(0)).toHaveAttribute('data-user-name', 'E2E HoF Gold')
  await expect(rankedRows.nth(0)).toHaveAttribute('data-rank', '1')
  await expect(rankedRows.nth(1)).toHaveAttribute('data-user-name', 'E2E HoF Silver')
  await expect(rankedRows.nth(1)).toHaveAttribute('data-rank', '2')
  await expect(rankedRows.nth(2)).toHaveAttribute('data-user-name', 'E2E HoF Bronze')
  await expect(rankedRows.nth(2)).toHaveAttribute('data-rank', '3')

  const goldRow = rankedRows.nth(0)
  await expect(goldRow.getByText('×1')).toBeVisible() // week trophy badge
  await expect(goldRow.getByText('×2')).toBeVisible() // month trophy badge
  await expect(goldRow.getByText('3 Pokale gesamt')).toBeVisible()

  const silverRow = rankedRows.nth(1)
  await expect(silverRow.getByText('×3')).toBeVisible() // week trophies
  await expect(silverRow.getByText('×1')).toBeVisible() // day trophies
  await expect(silverRow.getByText('4 Pokale gesamt')).toBeVisible()

  const bronzeRow = rankedRows.nth(2)
  await expect(bronzeRow.getByText('×5')).toBeVisible()
  await expect(bronzeRow.getByText('5 Pokale gesamt')).toBeVisible()

  // User with zero trophies never appears in the ranked list...
  await expect(page.locator('[data-testid="hof-ranked-row"][data-user-name="E2E HoF None"]')).toHaveCount(0)
  // ...but does show up in the separate "no trophies yet" section.
  await expect(page.locator('[data-testid="hof-no-trophies-row"][data-user-name="E2E HoF None"]')).toBeVisible()

  expect(errors).toEqual([])
})

test('hall of fame shows an empty state when nobody has any trophies', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)

  await page.route('**/api/tasks/stats', route => route.fulfill({
    json: [{ id: 'u-none', name: 'E2E HoF None', curDay: 0, curWeek: 0, curMonth: 0, dayTrophies: 0, weekTrophies: 0, monthTrophies: 0 }],
  }))
  await page.goto('/hall-of-fame')

  await expect(page.getByText('Noch keine Pokale vergeben.')).toBeVisible()
  await expect(page.locator('[data-testid="hof-ranked-row"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="hof-no-trophies-row"]')).toBeVisible()

  expect(errors).toEqual([])
})
