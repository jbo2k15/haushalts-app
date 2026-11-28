import ical from 'node-ical'

// Abruf des Dienstplan-Kalenders (DUTY_ICAL_URL), schonend für die Quelle:
//   - Timeout bricht die Anfrage wirklich ab (AbortSignal), statt sie im
//     Hintergrund weiterlaufen zu lassen
//   - ETag/Last-Modified werden gemerkt und als If-None-Match/
//     If-Modified-Since mitgeschickt; bei 304 gilt der zuletzt geladene Stand
//   - kurze Wiederholungen nur bei Netzfehler, Timeout oder 5xx ohne
//     Retry-After - nie bei 429
//   - 429 oder Retry-After: Abrufpause bis zum genannten Zeitpunkt, auch für
//     die nächsten geplanten Läufe
//   - jeder Abruf steht mit Status, Terminzahl und Dauer im Log - ohne
//     Adresse, denn der Link enthält den geheimen Schlüssel
//
// Der Stand (ETag, Termine, Pause) liegt nur im Arbeitsspeicher: nach einem
// Neustart wird einmal vollständig geladen.

const DEFAULT_PAUSE_MS = 60 * 60 * 1000
const MAX_PAUSE_MS = 24 * 60 * 60 * 1000

let cache = null // { url, etag, lastModified, events }
let pausedUntil = 0

export function resetDutyFeedState() {
  cache = null
  pausedUntil = 0
}

// Retry-After: Sekunden oder HTTP-Datum. Liefert Millisekunden (begrenzt auf
// 24 Stunden) oder null, wenn der Kopf fehlt oder unlesbar ist.
export function retryAfterMs(res, now = Date.now()) {
  const raw = res?.headers?.get?.('retry-after')
  if (raw == null || String(raw).trim() === '') return null
  const text = String(raw).trim()
  let ms
  if (/^\d+$/.test(text)) ms = Number(text) * 1000
  else {
    const at = Date.parse(text)
    if (Number.isNaN(at)) return null
    ms = at - now
  }
  return Math.min(Math.max(ms, 0), MAX_PAUSE_MS)
}

function pauseText(ms) {
  const minutes = Math.ceil(ms / 60000)
  return minutes >= 120 ? `${Math.round(minutes / 60)} Stunden` : `${minutes} Minuten`
}

// Liefert die Termine des Abos (wie node-ical: Objekt UID -> Eintrag) oder
// null, wenn gerade eine von der Quelle verlangte Abrufpause läuft. Wirft bei
// endgültigem Fehlschlag einen Fehler ohne Adresse im Text.
export async function fetchDutyFeed(url, { attempts = 3, timeoutMs = 15000, backoffMs = 5000 } = {}) {
  if (Date.now() < pausedUntil) {
    console.log(`Dienstplan: Kalenderabruf ausgesetzt (Quelle bat um Pause, noch ${pauseText(pausedUntil - Date.now())})`)
    return null
  }
  if (cache && cache.url !== url) cache = null

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now()
    let res
    let text = null
    try {
      const headers = { Accept: 'text/calendar' }
      if (cache?.etag) headers['If-None-Match'] = cache.etag
      else if (cache?.lastModified) headers['If-Modified-Since'] = cache.lastModified
      // Ein Signal für Kopf und Inhalt: läuft die Zeit ab, wird auch ein
      // hängender Download abgebrochen.
      res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 200) text = await res.text()
    } catch (err) {
      lastError = new Error(err?.name === 'TimeoutError' ? `Timeout nach ${Math.round(timeoutMs / 1000)} s` : 'Verbindung fehlgeschlagen')
      res = null
    }

    if (res) {
      const ms = Date.now() - started
      if (res.status === 304 && cache) {
        console.log(`Dienstplan: Kalender abgerufen (HTTP 304, unverändert, ${ms} ms)`)
        return cache.events
      }
      if (res.status === 200) {
        const events = ical.sync.parseICS(text)
        const count = Object.values(events).filter(e => e?.type === 'VEVENT').length
        cache = {
          url,
          etag: res.headers?.get?.('etag') || null,
          lastModified: res.headers?.get?.('last-modified') || null,
          events,
        }
        console.log(`Dienstplan: Kalender abgerufen (HTTP 200, ${count} Termine, ${ms} ms)`)
        return events
      }

      const wait = retryAfterMs(res)
      if (res.status === 429 || wait != null) {
        const pause = wait ?? DEFAULT_PAUSE_MS
        pausedUntil = Date.now() + pause
        throw new Error(`HTTP ${res.status} - Abruf pausiert für ${pauseText(pause)}`)
      }
      lastError = new Error(`HTTP ${res.status}`)
      // Andere 4xx (Link falsch, Schlüssel ungültig) ändern sich nicht in
      // ein paar Sekunden.
      if (res.status < 500) throw lastError
    }

    if (attempt < attempts) {
      const wait = backoffMs * attempt
      console.warn(`Dienstplan: Abrufversuch ${attempt}/${attempts} fehlgeschlagen (${lastError.message}) - neuer Versuch in ${Math.round(wait / 1000)} s`)
      await new Promise(resolve => setTimeout(resolve, wait))
    }
  }
  throw lastError
}
