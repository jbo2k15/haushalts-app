import { test, expect } from '@playwright/test'

// Die Selbst-Registrierung ist serverseitig abschaltbar (REGISTRATION_ENABLED,
// Standard: aus). Der E2E-Server läuft mit eingeschalteter Registrierung (siehe
// playwright.config.js); den ausgeschalteten Zustand stellt der Test her, indem
// er die Antwort von /api/auth/config ersetzt. Dass der Server selbst dann
// ablehnt, prüfen die Backend-Tests (auth.test.js).

async function mockConfig(page, registrationEnabled) {
  await page.route('**/api/auth/config', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ registrationEnabled }) }))
}

test('eingeschaltet: Anmeldeseite verlinkt die Registrierung, Formular ist da', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Registrieren' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByLabel('Name')).toBeVisible()
})

test('ausgeschaltet: kein Link auf der Anmeldeseite', async ({ page }) => {
  await mockConfig(page, false)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Passwort vergessen?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Registrieren' })).toHaveCount(0)
})

test('ausgeschaltet: /register zeigt einen Hinweis statt des Formulars', async ({ page }) => {
  await mockConfig(page, false)
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Registrierung deaktiviert' })).toBeVisible()
  await expect(page.getByLabel('E-Mail')).toHaveCount(0)
  await page.getByRole('link', { name: 'Zur Anmeldung' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('Konfiguration nicht abrufbar: verhält sich wie ausgeschaltet', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.abort())
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Registrierung deaktiviert' })).toBeVisible()
})
