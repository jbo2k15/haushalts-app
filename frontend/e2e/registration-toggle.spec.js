import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// Die Selbst-Registrierung ist abschaltbar (Standard: aus, Schalter für Admins
// in den Einstellungen). Die E2E-Datenbank wird mit eingeschalteter
// Registrierung geseedet (backend/scripts/e2e-seed.js); die Anzeige-Tests
// stellen "aus" her, indem sie die Antwort von /api/auth/config ersetzen, der
// letzte Test schaltet wirklich um.

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

// Zuletzt, weil dieser Test den echten Server-Zustand umschaltet. Er stellt am
// Ende "eingeschaltet" wieder her (spätere Specs wie route-smoke öffnen
// /register); bräche er mittendrin ab, zeigt /register nur den Hinweis.
test('Admin schaltet die Registrierung in den Einstellungen aus und wieder ein', async ({ page }) => {
  const config = async () => (await (await page.request.get('/api/auth/config')).json()).registrationEnabled

  await login(page)
  await page.goto('/settings')

  const toggle = page.locator('[data-testid="registration-toggle"]')
  await expect(toggle).toHaveAttribute('data-registration-enabled', 'true')

  // Ausschalten braucht keine Rückfrage.
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-registration-enabled', 'false')
  expect(await config()).toBe(false)

  // Der Server lehnt jetzt wirklich ab - nicht nur die Anzeige ändert sich.
  const res = await page.request.post('/api/auth/register', {
    data: { email: 'toggle-aus@example.com', password: 'Sicher1234!', name: 'Darf nicht' },
  })
  expect(res.status()).toBe(404)

  // Einschalten öffnet einen öffentlichen Weg → Bestätigungsdialog.
  await toggle.click()
  await page.locator('[data-testid="confirm-dialog-confirm"]').click()
  await expect(toggle).toHaveAttribute('data-registration-enabled', 'true')
  expect(await config()).toBe(true)
})
