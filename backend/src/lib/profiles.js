// Familien-Display: Profile sind Personen ohne Anmeldung (z. B. Kinder). Sie
// koennen Aufgaben "erledigt haben" und Punkte sammeln, sich aber nie anmelden.
//
// Technisch bleibt ein Profil ein User-Datensatz, damit Erledigungen, Punkte
// und Pokale ohne Sonderweg funktionieren. Weil E-Mail und Passwort-Hash in der
// Datenbank Pflichtfelder sind, bekommt ein Profil
//   - eine Platzhalter-Adresse unter der reservierten Domain ".invalid"
//     (RFC 2606: wird nie zugestellt und kann nie registriert werden) und
//   - einen Passwort-Hash, der kein gueltiger bcrypt-Hash ist; bcrypt.compare
//     liefert dafuer immer false.
// Zusaetzlich weisen Anmeldung, Token-Erneuerung und requireAuth Profile
// ausdruecklich ab (kind === 'profile'), damit die Sperre nicht allein am
// unbrauchbaren Hash haengt.
import { randomUUID } from 'crypto'

export const KIND_ACCOUNT = 'account'
export const KIND_PROFILE = 'profile'

export const UNUSABLE_PASSWORD_HASH = '!'

export function isProfile(user) {
  return user?.kind === KIND_PROFILE
}

export function newProfileEmail() {
  return `profil-${randomUUID()}@profil.invalid`
}

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

// null/leer = keine Farbe. Rueckgabe: Fehlermeldung oder null.
export function validateColor(color) {
  if (color == null || color === '') return null
  if (typeof color !== 'string' || !COLOR_REGEX.test(color)) return 'Ungültige Farbe (erwartet #RRGGBB)'
  return null
}

export function normalizeColor(color) {
  return color ? color.toUpperCase() : null
}

export function validateProfileName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) return 'Name darf nicht leer sein'
  if (name.trim().length > 100) return 'Name darf maximal 100 Zeichen haben'
  return null
}
