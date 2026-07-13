import { randomBytes } from 'crypto'

// Kurzlebige Einmal-Tickets für die SSE-Verbindung. Grund: die Browser-
// EventSource-API kann keine Authorization-Header setzen, daher muss die
// Authentifizierung über die URL laufen. Statt des vollen Access-Tokens (15 min,
// würde in Browser-History/Referer/Proxy-Logs leaken) geben wir ein Ticket aus,
// das nur ~30 s gültig und genau einmal einlösbar ist.
//
// Bewusst In-Memory: die App läuft als Einzelinstanz (self-hosted). Bei
// horizontaler Skalierung müsste dies durch einen gemeinsamen Store (z. B.
// Redis) ersetzt werden.

const TICKET_TTL_MS = 30 * 1000
const tickets = new Map() // ticket -> { userId, expiresAt }

function sweepExpired(now) {
  for (const [t, entry] of tickets) {
    if (entry.expiresAt <= now) tickets.delete(t)
  }
}

export function issueTicket(userId) {
  const now = Date.now()
  sweepExpired(now) // verhindert unbegrenztes Wachstum bei nie eingelösten Tickets
  const ticket = randomBytes(32).toString('base64url')
  tickets.set(ticket, { userId, expiresAt: now + TICKET_TTL_MS })
  return ticket
}

// Löst ein Ticket ein und gibt die userId zurück - oder null, wenn das Ticket
// unbekannt, bereits benutzt oder abgelaufen ist. Single-use: ein gültiges
// Ticket wird beim Einlösen sofort entfernt.
export function consumeTicket(ticket) {
  if (typeof ticket !== 'string' || !ticket) return null
  const entry = tickets.get(ticket)
  if (!entry) return null
  tickets.delete(ticket)
  if (entry.expiresAt <= Date.now()) return null
  return entry.userId
}

// Nur für Tests: setzt den Store zurück.
export function _resetTickets() {
  tickets.clear()
}
