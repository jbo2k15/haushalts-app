import prisma from '../lib/prisma.js'
import { addDaysToDateString } from '../lib/dates.js'

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
// alle 15 Minuten nachgeholt (scheduler.js).

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

// Meldet den aktuellen Stand eines Dienstes (abgehakt oder nicht) an die
// Quelle. Liest den Stand frisch aus der Datenbank, deshalb ist es egal, wie
// oft und in welcher Reihenfolge das aufgerufen wird.
export async function pushDutyState(taskId) {
  const config = dutyDoneConfig()
  if (!config) return 'off'
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.autoSource !== 'duty' || !task.externalUid || task.externalSync !== 'pending') return 'skipped'
  const erledigt = !!(await prisma.taskCompletion.findFirst({ where: { taskId, forDate: task.dueDate }, select: { id: true } }))

  let status
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: config.key, uid: task.externalUid, erledigt }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    status = res.status
  } catch (err) {
    // Fehlertext kann die Adresse enthalten, der Schlüssel steht nur im Body.
    console.warn(`Dienstplan: Rückmeldung für "${task.title}" (${task.dueDate}) nicht zugestellt (${err.name || 'Fehler'}) - neuer Versuch später`)
    return 'retry'
  }

  if (status === 200) {
    // Nur als erledigt markieren, wenn sich der Stand inzwischen nicht wieder
    // geändert hat (Haken direkt danach zurückgenommen): dann bleibt "pending".
    const still = !!(await prisma.taskCompletion.findFirst({ where: { taskId, forDate: task.dueDate }, select: { id: true } }))
    if (still === erledigt) {
      await prisma.task.update({ where: { id: taskId }, data: { externalSync: 'synced', externalPushedAt: new Date() } })
    }
    return 'ok'
  }
  if (status === 404) {
    console.error(`Dienstplan: Rückmeldung für "${task.title}" (${task.dueDate}) abgelehnt (404: Termin unbekannt oder Schlüssel ohne Berechtigung)`)
    await prisma.task.update({ where: { id: taskId }, data: { externalSync: 'rejected' } })
    return 'rejected'
  }
  console.warn(`Dienstplan: Rückmeldung für "${task.title}" (${task.dueDate}) fehlgeschlagen (HTTP ${status}) - neuer Versuch später`)
  return 'retry'
}

// Holt liegengebliebene Meldungen nach. Dienste von gestern zählen noch mit
// (kurz vor Mitternacht abgehakt, Quelle gerade nicht erreichbar), ältere
// nicht mehr.
export async function retryPendingDutyPushes() {
  if (!dutyDoneConfig()) return
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date())
  const pending = await prisma.task.findMany({
    where: { autoSource: 'duty', externalSync: 'pending', dueDate: { gte: addDaysToDateString(today, -1) } },
    select: { id: true },
  })
  for (const { id } of pending) await pushDutyState(id)
}
