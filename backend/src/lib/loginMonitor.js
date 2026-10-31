// Reines Alerting (kein Schutzmechanismus): der eigentliche Brute-Force-Schutz
// kommt vom Rate-Limiter auf /api/auth/login (siehe app.js) und der
// Kontosperre in routes/auth.js. Hier wird nur ein auffälliges Aufkommen
// fehlgeschlagener Logins geloggt. Bewusst global + in-memory (kein
// Persistieren über Neustarts).
//
// Jeder Fehlversuch wird mit IP und maskierter E-Mail protokolliert, und der
// Alert nennt die häufigsten IPs/E-Mails im Zeitfenster - so lässt sich ohne
// Zugriff auf weitere Logs erkennen, ob ein einzelner Absender oder ein
// einzelnes Konto dahintersteckt. E-Mails werden maskiert (t***@gmail.com),
// damit vollständige Adressen nicht in den Container-Logs landen.

const WINDOW_MS = 60 * 60 * 1000
const THRESHOLD = 20
const TOP_N = 3

let failedAttempts = [] // { t, ip, email }
let alerted = false

export function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '(ungültig)'
  const [local, domain] = email.toLowerCase().split('@')
  return `${local.slice(0, 1) || '?'}***@${domain || '?'}`
}

function topCounts(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([v, n]) => `${v} (${n}x)`)
    .join(', ')
}

export function recordFailedLogin({ ip, email, knownUser } = {}) {
  const now = Date.now()
  const entry = { t: now, ip: ip || 'unbekannt', email: maskEmail(email) }
  failedAttempts.push(entry)
  failedAttempts = failedAttempts.filter(a => now - a.t < WINDOW_MS)

  console.info(`[AUTH] Fehlgeschlagener Login: ip=${entry.ip} email=${entry.email}${knownUser === false ? ' (unbekanntes Konto)' : ''}`)

  // >= statt == : ein exakter Gleichheitsvergleich verpasst den Alert, wenn die
  // Zählung die Schwelle nicht genau trifft. Der alerted-Merker verhindert
  // Log-Spam bei jedem weiteren Versuch oberhalb der Schwelle; fällt die
  // Zählung wieder darunter (Fenster läuft ab), meldet das nächste
  // Überschreiten erneut.
  if (failedAttempts.length >= THRESHOLD) {
    if (!alerted) {
      const ips = topCounts(failedAttempts.map(a => a.ip))
      const emails = topCounts(failedAttempts.map(a => a.email))
      console.warn(`[SECURITY] Mindestens ${THRESHOLD} fehlgeschlagene Login-Versuche in der letzten Stunde — möglicher Brute-Force-Versuch. Häufigste IPs: ${ips}. Häufigste Konten: ${emails}.`)
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
