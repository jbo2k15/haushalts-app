// Reines Alerting (kein Schutzmechanismus): der eigentliche Brute-Force-Schutz
// kommt vom Rate-Limiter auf /api/auth/login (siehe app.js). Hier wird nur ein
// auffälliges Aufkommen fehlgeschlagener Logins geloggt. Bewusst global +
// in-memory (kein Persistieren über Neustarts).

const WINDOW_MS = 60 * 60 * 1000
const THRESHOLD = 20

let failedAttempts = []
let alerted = false

export function recordFailedLogin() {
  const now = Date.now()
  failedAttempts.push(now)
  failedAttempts = failedAttempts.filter(t => now - t < WINDOW_MS)

  // >= statt == : ein exakter Gleichheitsvergleich verpasst den Alert, wenn die
  // Zählung die Schwelle nicht genau trifft. Der alerted-Merker verhindert
  // Log-Spam bei jedem weiteren Versuch oberhalb der Schwelle; fällt die
  // Zählung wieder darunter (Fenster läuft ab), meldet das nächste
  // Überschreiten erneut.
  if (failedAttempts.length >= THRESHOLD) {
    if (!alerted) {
      console.warn(`[SECURITY] Mindestens ${THRESHOLD} fehlgeschlagene Login-Versuche in der letzten Stunde — möglicher Brute-Force-Versuch.`)
      alerted = true
    }
  } else {
    alerted = false
  }
}

// Nur für Tests: setzt den In-Memory-Zustand zurück.
export function _resetLoginMonitor() {
  failedAttempts = []
  alerted = false
}
