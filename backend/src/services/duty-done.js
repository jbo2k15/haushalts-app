import prisma from '../lib/prisma.js'
import { addDaysToDateString } from '../lib/dates.js'
import { retryAfterMs } from './duty-feed.js'

// Rückmeldung an die Quelle des Dienstplan-Kalenders: Wird ein Dienst in der
// Haushalts-App abgehakt (oder der Haken zurückgenommen), meldet die App das
// an die Hühnerstall-App, damit er dort nicht noch einmal abgehakt werden muss.
//
//   DUTY_DONE_URL  Adresse der Schnittstelle (https). Ohne sie bleibt alles aus.
//   DUTY_DONE_KEY  optional: geheimer Schlüssel. Fehlt er, wird der Schlüssel
//                  aus dem Kalender-Link (DUTY_ICAL_URL, Parameter "key" oder
//                  "token") verwendet - es ist derselbe.
//
// Vertrag: POST { key, uid, erledigt } - idempotent. 200 = Zustand bestätigt,
// 404 = unbekannter Termin oder keine Berechtigung (endgültig), alles andere
// (503, Netzwerk) = später erneut versuchen.
//
// Der Haken in der Haushalts-App hängt nie an dieser Meldung: Sie läuft
// nebenher, und was nicht ankommt, bleibt als "pending" vorgemerkt und wird
// vom Scheduler mit wachsendem Abstand nachgeholt (siehe unten). Jede
// Meldung steht mit Ergebnis und Dauer im Log - nie mit Adresse oder Schlüssel.

const TZ = 'Europe/Berlin'
const TIMEOUT_MS = 8000
// Nach einer bestätigten Meldung kann das Kalender-Abo noch kurz den alten
// Stand liefern. So lange gewinnt der eigene Stand (siehe duty-calendar.js).
export const PUSH_SETTLE_MS = 10 * 60 * 1000

let warnedConfig = false

export function dutyDoneConfig() {
  const url = (process.env.DUTY_DONE_URL || '').trim()
  if (!url) return null
  let key = (process.env.DUTY_DONE_KEY || '').trim()
  if (!key) {
    try {
      const params = new URL(process.env.DUTY_ICAL_URL || '').searchParams
      key = params.get('key') || params.get('token') || ''
    } catch { /* kein gültiger Kalender-Link */ }
  }
  if (!url.startsWith('https://') || !key) {
    if (!warnedConfig) {
      warnedConfig = true
      console.error(!key
        ? 'Dienstplan: DUTY_DONE_URL ist gesetzt, aber kein Schlüssel gefunden - DUTY_DONE_KEY eintragen'
        : 'Dienstplan: DUTY_DONE_URL muss mit https:// beginnen')
    }
    return null
  }
  return { url, key }
}

// Nach dem Abhaken/Zurücknehmen aufrufen: merkt die Meldung vor. Gibt true
// zurück, wenn etwas zu melden ist.
export async function markDutyPending(task) {
  if (task.autoSource !== 'duty' || !task.externalUid || !dutyDoneConfig()) return false
  await prisma.task.update({ where: { id: task.id }, data: { externalSync: 'pending' } })
  return true
}

// Wiederholungen mit wachsendem Abstand: nach dem 1. Fehlschlag frühestens
// nach 15 Minuten, dann 30, 60, 120, höchstens alle 4 Stunden. Verlangt die
// Quelle eine Pause (429 oder Retry-After), ruht die Schnittstelle so lange
// für alle Dienste - auch für frisch abgehakte, die bleiben vorgemerkt.
// Der Stand liegt nur im Arbeitsspeicher; nach einem Neustart wird einmal
// sofort neu versucht.
const RETRY_BASE_MS = 15 * 60 * 1000
const RETRY_MAX_MS = 4 * 60 * 60 * 1000
// Der Scheduler tickt genau alle 15 Minuten; ohne etwas Luft würde der
// nächste Lauf den Zeitpunkt um Millisekunden verfehlen.
const RETRY_SLACK_MS = 60 * 1000
const DEFAULT_PAUSE_MS = 60 * 60 * 1000

const backoff = new Map() // taskId -> { failures, nextAt }
let pausedUntil = 0

export function resetDutyDoneState() {
  backoff.clear()
  pausedUntil = 0
  warnedConfig = false
}

function scheduleRetry(taskId) {
  const failures = (backoff.get(taskId)?.failures ?? 0) + 1
  const delay = Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS)
  backoff.set(taskId, { failures, nextAt: Date.now() + delay - RETRY_SLACK_MS })
  return delay
}

const minutesText = ms => `${Math.ceil(ms / 60000)} min`

// Meldet den aktuellen Stand eines Dienstes (abgehakt oder nicht) an die
// Quelle. Liest den Stand frisch aus der Datenbank, deshalb ist es egal, wie
// oft und in welcher Reihenfolge das aufgerufen wird.
// immediate: direkt nach einer Änderung durch eine Person - übergeht den
// Wiederholungsabstand dieses Dienstes, nicht aber eine verlangte Pause.
export async function pushDutyState(taskId, { immediate = false } = {}) {
  const config = dutyDoneConfig()
  if (!config) return 'off'
  if (Date.now() < pausedUntil) return 'paused'
  if (!immediate && (backoff.get(taskId)?.nextAt ?? 0) > Date.now()) return 'waiting'
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.autoSource !== 'duty' || !task.externalUid || task.externalSync !== 'pending') {
    backoff.delete(taskId)
    return 'skipped'
  }
  const erledigt = !!(await prisma.taskCompletion.findFirst({ where: { taskId, forDate: task.dueDate }, select: { id: true } }))
  const what = `Rückmeldung "${task.title}" (${task.dueDate}, erledigt=${erledigt})`

  const started = Date.now()
  let res
  try {
    res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.key, uid: task.externalUid, erledigt }),
      // Bricht die Anfrage nach Ablauf wirklich ab.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    // Fehlertext kann die Adresse enthalten, der Schlüssel steht nur im Body.
    const delay = scheduleRetry(taskId)
    console.warn(`Dienstplan: ${what} nicht zugestellt (${err?.name === 'TimeoutError' ? 'Timeout' : 'Verbindung fehlgeschlagen'}) - neuer Versuch frühestens in ${minutesText(delay)}`)
    return 'retry'
  }
  const status = res.status
  const ms = Date.now() - started

  if (status === 200) {
    backoff.delete(taskId)
    // Nur als erledigt markieren, wenn sich der Stand inzwischen nicht wieder
    // geändert hat (Haken direkt danach zurückgenommen): dann bleibt "pending".
    const still = !!(await prisma.taskCompletion.findFirst({ where: { taskId, forDate: task.dueDate }, select: { id: true } }))
    if (still === erledigt) {
      await prisma.task.update({ where: { id: taskId }, data: { externalSync: 'synced', externalPushedAt: new Date() } })
    }
    console.log(`Dienstplan: ${what} bestätigt (HTTP 200, ${ms} ms)`)
    return 'ok'
  }
  if (status === 404) {
    backoff.delete(taskId)
    console.error(`Dienstplan: ${what} abgelehnt (HTTP 404: Termin unbekannt oder Schlüssel ohne Berechtigung)`)
    await prisma.task.update({ where: { id: taskId }, data: { externalSync: 'rejected' } })
    return 'rejected'
  }

  const delay = scheduleRetry(taskId)
  const wait = retryAfterMs(res)
  if (status === 429 || wait != null) {
    const pause = wait ?? DEFAULT_PAUSE_MS
    pausedUntil = Date.now() + pause
    console.warn(`Dienstplan: ${what} fehlgeschlagen (HTTP ${status}) - Quelle bittet um Pause, Rückmeldungen ruhen ${minutesText(pause)}`)
    return 'paused'
  }
  console.warn(`Dienstplan: ${what} fehlgeschlagen (HTTP ${status}) - neuer Versuch frühestens in ${minutesText(delay)}`)
  return 'retry'
}

// Holt liegengebliebene Meldungen nach. Dienste von gestern zählen noch mit
// (kurz vor Mitternacht abgehakt, Quelle gerade nicht erreichbar), ältere
// nicht mehr.
export async function retryPendingDutyPushes() {
  if (!dutyDoneConfig() || Date.now() < pausedUntil) return
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date())
  const pending = await prisma.task.findMany({
    where: { autoSource: 'duty', externalSync: 'pending', dueDate: { gte: addDaysToDateString(today, -1) } },
    select: { id: true },
  })
  for (const { id } of pending) {
    if (await pushDutyState(id) === 'paused') break
  }
}
