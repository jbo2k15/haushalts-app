// Pausenzeitraum-Domänenlogik: reine Datums-String-Helfer + Prisma-CRUD für
// individuelle (pro Aufgabe) und globale (haushaltsweite) Pausen. Beide Quellen
// sind unabhängig voneinander und werden per ODER verknüpft (siehe TODO.md).
import prisma from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'

export function validatePauseRange(pauseFrom, pauseTo) {
  if (!pauseFrom && !pauseTo) return null
  if (!pauseFrom || !pauseTo) return 'Von und Bis müssen zusammen gesetzt werden'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pauseFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(pauseTo)) {
    return 'Ungültiges Datumsformat (YYYY-MM-DD)'
  }
  if (pauseFrom > pauseTo) return 'Von darf nicht nach Bis liegen'
  return null
}

export function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function weekEndFromStart(weekStart) {
  return addDaysToDateString(weekStart, 6)
}

export function monthEndFromStart(monthStart) {
  const [y, m] = monthStart.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function isDayInRange(dateStr, range) {
  if (!range || !range.pauseFrom || !range.pauseTo) return false
  return dateStr >= range.pauseFrom && dateStr <= range.pauseTo
}

export function isPausedOnDay(individualRange, globalRange, dateStr) {
  return isDayInRange(dateStr, individualRange) || isDayInRange(dateStr, globalRange)
}

export function isPeriodFullyPaused(periodStart, periodEnd, ranges) {
  const clipped = (ranges || [])
    .filter(r => r && r.pauseFrom && r.pauseTo && r.pauseFrom <= periodEnd && r.pauseTo >= periodStart)
    .map(r => ({
      from: r.pauseFrom > periodStart ? r.pauseFrom : periodStart,
      to: r.pauseTo < periodEnd ? r.pauseTo : periodEnd,
    }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))

  if (clipped.length === 0) return false

  let coveredUntil = null
  for (const range of clipped) {
    if (coveredUntil === null) {
      if (range.from > periodStart) return false
      coveredUntil = range.to
      continue
    }
    // Eine Lücke von auch nur einem Tag zwischen zwei Zeiträumen zählt als
    // Unterbrechung - "angrenzend" heißt daher: nächster Start höchstens
    // einen Tag nach dem bisher abgedeckten Ende.
    if (range.from > addDaysToDateString(coveredUntil, 1)) return false
    if (range.to > coveredUntil) coveredUntil = range.to
  }
  return coveredUntil >= periodEnd
}

export async function getIndividualPause(taskId) {
  return prisma.taskPause.findFirst({ where: { taskId }, orderBy: { createdAt: 'desc' } })
}

export async function getIndividualPausesForTasks(taskIds) {
  const map = new Map()
  if (!taskIds || taskIds.length === 0) return map
  const rows = await prisma.taskPause.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { createdAt: 'desc' },
  })
  for (const row of rows) {
    if (!map.has(row.taskId)) map.set(row.taskId, row)
  }
  return map
}

export async function setIndividualPause(taskId, { pauseFrom, pauseTo }, userId) {
  await prisma.taskPause.deleteMany({ where: { taskId } })
  if (pauseFrom && pauseTo) {
    return prisma.taskPause.create({ data: { taskId, pauseFrom, pauseTo, createdBy: userId || null } })
  }
  return null
}

export async function getGlobalPause() {
  return prisma.globalPause.findFirst({ orderBy: { createdAt: 'desc' } })
}

export async function setGlobalPause({ pauseFrom, pauseTo }, userId) {
  const err = validatePauseRange(pauseFrom, pauseTo)
  if (err) throw httpError(400, err)

  await prisma.globalPause.deleteMany()
  if (pauseFrom && pauseTo) {
    return prisma.globalPause.create({ data: { pauseFrom, pauseTo, createdBy: userId || null } })
  }
  return null
}

export async function clearGlobalPause() {
  await prisma.globalPause.deleteMany()
  return { message: 'Pause beendet' }
}
