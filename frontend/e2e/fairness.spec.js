import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { attachErrorCollector, login } from './helpers.js'

// Fairness-Statistik. Die Rechnung selbst ist im Backend per Vitest getestet
// (tests/domain/fairness.test.js); hier wird die Darstellung mit festen Daten
// geprueft (gemockte API) sowie Aufwand und Freigabe gegen das echte Backend.

const MOCK = {
  today: '2026-11-09',
  window: { from: '2026-10-11', to: '2026-11-09' },
  totalPoints: 84,
  lowData: false,
  persons: [
    { id: 'a', name: 'E2E Fair A', points: 48, count: 31, avgWeight: 1.5, presentDays: 30, vacationDays: 0, share: 57 },
    { id: 'b', name: 'E2E Fair B', points: 36, count: 22, avgWeight: 1.6, presentDays: 24, vacationDays: 6, share: 43 },
  ],
  mostlyAway: [],
  previous: { from: '2026-09-11', to: '2026-10-10', persons: [{ id: 'a', name: 'E2E Fair A', share: 63 }, { id: 'b', name: 'E2E Fair B', share: 37 }] },
  trend: 'more-balanced',
  weeks: [
    { label: 'KW 42', from: '2026-10-12', to: '2026-10-18', totalPoints: 20, lowData: false, persons: [{ id: 'a', name: 'E2E Fair A', share: 61, points: 12 }, { id: 'b', name: 'E2E Fair B', share: 39, points: 8 }], mostlyAway: [] },
    { label: 'KW 43', from: '2026-10-19', to: '2026-10-25', totalPoints: 4, lowData: true, persons: [{ id: 'a', name: 'E2E Fair A', share: 100, points: 4 }], mostlyAway: [] },
    { label: 'KW 44', from: '2026-10-26', to: '2026-11-01', totalPoints: 22, lowData: false, persons: [{ id: 'a', name: 'E2E Fair A', share: 55, points: 12 }, { id: 'b', name: 'E2E Fair B', share: 45, points: 10 }], mostlyAway: [] },
    { label: 'KW 45', from: '2026-11-02', to: '2026-11-08', totalPoints: 25, lowData: false, persons: [{ id: 'a', name: 'E2E Fair A', share: 56, points: 14 }, { id: 'b', name: 'E2E Fair B', share: 44, points: 11 }], mostlyAway: [] },
  ],
  people: [{ id: 'a', name: 'E2E Fair A' }, { id: 'b', name: 'E2E Fair B' }],
}

async function mockFairness(page, data = MOCK) {
  await page.route('**/api/fairness/config', route => route.fulfill({ json: { enabled: true, canView: true } }))
  await page.route('**/api/fairness', route => route.fulfill({ json: data }))
}

test('Fairness-Karte zeigt Anteile, Urlaub, Trend und Wochenverlauf', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await mockFairness(page)
  await login(page)
  await page.goto('/hall-of-fame')

  const card = page.locator('[data-testid="fairness-card"]')
  await expect(card).toBeVisible()
  await expect(card.locator('[data-testid="fairness-person"][data-person-name="E2E Fair A"]')).toHaveAttribute('data-share', '57')
  await expect(card.locator('[data-testid="fairness-person"][data-person-name="E2E Fair B"]')).toContainText('6 Urlaubstage herausgerechnet')
  await expect(card.getByRole('img', { name: 'Gewichteter Anteil: E2E Fair A 57 Prozent, E2E Fair B 43 Prozent' })).toBeVisible()
  await expect(card.locator('[data-testid="fairness-trend"]')).toContainText('Ausgeglichener als in den 30 Tagen davor')
  await expect(card.locator('[data-testid="fairness-week"]')).toHaveCount(4)
  await expect(card).toContainText('KW 43: nur 4 Punkte – Woche wenig aussagekräftig.')
  await expect(card).toContainText('Ø Aufwand 1,5')

  const results = await new AxeBuilder({ page }).include('[data-testid="fairness-card"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map(v => v.id)).toEqual([])
  expect(errors).toEqual([])
})

test('Fairness-Karte: leerer Zustand und Hinweis bei Urlaub', async ({ page }) => {
  await mockFairness(page, { ...MOCK, totalPoints: 0, persons: [], previous: null, trend: null, people: [] })
  await login(page)
  await page.goto('/hall-of-fame')
  await expect(page.locator('[data-testid="fairness-empty"]')).toHaveText('Noch keine Erledigungen in diesem Zeitraum.')
})

test('ohne Freigabe erscheint keine Fairness-Karte', async ({ page }) => {
  await login(page)
  await page.goto('/hall-of-fame')
  await expect(page.locator('[data-testid="hof-no-trophies-row"]').first()).toBeVisible()
  await expect(page.locator('[data-testid="fairness-card"]')).toHaveCount(0)
})

test('Admin stuft den Aufwand einer Aufgabe ein', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/admin')

  const title = `E2E Aufwand ${Date.now()}`
  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click()
  await page.getByLabel('Titel').fill(title)
  await page.locator('[data-testid="difficulty-3"]').click()
  await expect(page.locator('[data-testid="difficulty-3"]')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Aufgabe erstellen' }).click()

  const row = page.locator('[data-testid="sortable-task"]', { hasText: title })
  await expect(row.locator('[data-testid="difficulty-badge"]')).toHaveText('Aufwändig')

  await row.getByRole('button', { name: 'Bearb.' }).click()
  await expect(page.locator('[data-testid="difficulty-3"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-testid="difficulty-1"]').click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(row.locator('[data-testid="difficulty-badge"]')).toHaveText('Leicht')

  // Aufraeumen - andere Specs erwarten die seed-basierte Aufgabenliste.
  await row.getByRole('button', { name: 'Löschen' }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(row).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Admin gibt sich die Fairness-Statistik frei und trägt Urlaub nach', async ({ page }) => {
  const errors = attachErrorCollector(page)
  await login(page)
  await page.goto('/settings')

  const me = page.locator('[data-testid="fairness-user"][data-user-name="E2E Test User"]')
  const toggle = me.locator('[data-testid="fairness-visibility"]')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  await me.locator('[data-testid="vacation-add"]').click()
  await me.getByLabel('Von').fill('2026-10-20')
  await me.getByLabel('Bis').fill('2026-10-25')
  await me.getByRole('button', { name: 'Speichern' }).click()
  await expect(me.locator('[data-testid="vacation-row"]')).toContainText('6 Urlaubstage · nachgetragen')

  await page.goto('/hall-of-fame')
  await expect(page.locator('[data-testid="fairness-card"]')).toBeVisible()

  // Aufraeumen: Urlaubszeit loeschen, Freigabe zuruecknehmen.
  await page.goto('/settings')
  await me.locator('[data-testid="vacation-row"]').getByRole('button', { name: /löschen/ }).click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(me.locator('[data-testid="vacation-row"]')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(errors).toEqual([])
})
