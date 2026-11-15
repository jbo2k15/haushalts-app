import { createHash } from 'crypto'
import prisma from '../lib/prisma.js'

// Familien-Display: Zugang fuer ein Wanddisplay ueber einen eigenen
// Schluessel (DisplayToken) statt ueber ein Nutzerkonto.
//
// Sicherheitsgrenze:
//   - Hauptschalter DISPLAY_API_ENABLED: ohne "true" antworten alle
//     Display-Endpunkte mit 404, als gaebe es sie nicht.
//   - Ein Display-Schluessel gilt NUR hier. requireAuth akzeptiert ihn nicht
//     (kein JWT), und umgekehrt akzeptiert requireDisplay kein Nutzer-Token.
//   - Der Schluessel traegt keine Nutzeridentitaet; req.user wird nie gesetzt.
//   - Nur im Heimnetz: Anfragen, die ueber Cloudflare hereinkommen (oeffentliche
//     Adresse der App), werden abgewiesen - auch mit gueltigem Schluessel. So
//     haengt der Schutz nicht allein an einer Regel im Cloudflare-Konto.

export const DISPLAY_TOKEN_PREFIX = 'hd_'
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000

export function isDisplayApiEnabled() {
  return process.env.DISPLAY_API_ENABLED === 'true'
}

// Cloudflare setzt diese Header an JEDER durchgeleiteten Anfrage und
// ueberschreibt vom Client mitgeschickte Werte - wer ueber die oeffentliche
// Adresse kommt, kann sie also nicht weglassen. Eine Anfrage direkt im
// Heimnetz (Home Assistant -> App) traegt sie nicht. Umgekehrt koennte jemand
// im Heimnetz sie hinzufuegen, sperrt sich damit aber nur selbst aus.
// DISPLAY_API_ALLOW_PROXIED=true hebt die Sperre auf (z. B. wenn das Display
// bewusst ueber die oeffentliche Adresse angebunden werden soll).
const CLOUDFLARE_HEADERS = ['cf-connecting-ip', 'cf-ray', 'cf-ipcountry', 'cdn-loop']

export function cameThroughCloudflare(req) {
  return CLOUDFLARE_HEADERS.some(h => req.headers[h] !== undefined)
}

export function hashDisplayToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function requireDisplay(req, res, next) {
  if (!isDisplayApiEnabled()) return res.status(404).json({ error: 'Nicht gefunden' })
  // Gleiche Antwort wie bei ausgeschaltetem Zugang: von aussen sieht es aus,
  // als gaebe es die Endpunkte nicht.
  if (process.env.DISPLAY_API_ALLOW_PROXIED !== 'true' && cameThroughCloudflare(req)) {
    return res.status(404).json({ error: 'Nicht gefunden' })
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' })
  const token = header.slice(7)
  // Praefix-Pruefung vor dem DB-Zugriff: ein Nutzer-JWT (oder beliebiger
  // Muell) loest so gar keine Abfrage aus.
  if (!token.startsWith(DISPLAY_TOKEN_PREFIX) || token.length > 200) return res.status(401).json({ error: 'Nicht autorisiert' })

  const stored = await prisma.displayToken.findUnique({ where: { tokenHash: hashDisplayToken(token) } })
  if (!stored) return res.status(401).json({ error: 'Nicht autorisiert' })

  // lastUsedAt nur gelegentlich schreiben: ein Display fragt im Minutentakt
  // ab, ein Schreibzugriff pro Abruf waere unnoetige Last auf der SQLite-DB.
  if (!stored.lastUsedAt || Date.now() - stored.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    prisma.displayToken.update({ where: { id: stored.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  }

  req.displayToken = { id: stored.id, name: stored.name }
  next()
}
