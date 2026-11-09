// Fairness-Statistik: wer traegt wie viel zum Haushalt bei, gewichtet nach
// Aufwand und mit herausgerechnetem Urlaub. Spezifikation: TODO.md
// "Fairness-Transparenz in der Ruhmeshalle".
//
// Das Feature ist bewusst in diesem Modul (plus routes/fairness.js und den
// Frontend-Dateien unter components/fairness/) gebuendelt, damit es sich
// sauber abschalten (FAIRNESS_ENABLED=false) oder ganz entfernen laesst -
// siehe docs/fairness-entfernen.md. Die wenigen Stellen im restlichen Code,
// die hierher rufen, sind dort aufgelistet.
import prisma from '../lib/prisma.js'
import { httpError } from '../lib/httpError.js'
import { todayString, addDaysToDateString, mondayOnOrBefore } from '../lib/dates.js'
import { EXCLUDE_ONCE, getUTCRangeForBerlinDay } from './tasks.js'

const TZ = 'Europe/Berlin'

export const DIFFICULTIES = [1, 2, 3]
export const DEFAULT_DIFFICULTY = 2

export const WINDOW_DAYS = 30
export const WEEK_COUNT = 4
// Unter so vielen Anwesenheitstagen erscheint eine Person nicht im Balken.
export const MIN_PRESENT_DAYS_WINDOW = 7
export const MIN_PRESENT_DAYS_WEEK = 2
// Unter so vielen Punkten gilt ein Zeitraum als wenig aussagekraeftig.
export const LOW_DATA_POINTS_WINDOW = 10
export const LOW_DATA_POINTS_WEEK = 5
// Ab dieser Aenderung der Spreizung (Prozentpunkte) gilt die Verteilung als
// ausgeglichener bzw. ungleicher als im Zeitraum davor.
export const TREND_THRESHOLD = 5
const MAX_VACATION_DAYS = 366

export function isFairnessEnabled() {
  return process.env.FAIRNESS_ENABLED !== 'false'
}

// ---------------------------------------------------------------------------
// Zaehlweise fuer Rangliste (Pokale) und Statistik auf der Startseite
// ---------------------------------------------------------------------------

export const COUNT_MODES = ['count', 'weighted']

// "count" = nach Anzahl Erledigungen (Standard, Verhalten von vor dem
// Feature), "weighted" = nach Aufwands-Punkten. Ist das Feature abgeschaltet,
// wird immer nach Anzahl gezaehlt.
export async function getCountMode() {
  if (!isFairnessEnabled()) return 'count'
  const settings = await prisma.fairnessSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.countMode === 'weighted' ? 'weighted' : 'count'
}

export async function setCountMode(countMode) {
  if (!COUNT_MODES.includes(countMode)) throw httpError(400, 'Ungültige Zählweise')
  await prisma.fairnessSettings.upsert({
    where: { id: 'singleton' },
    update: { countMode },
    create: { id: 'singleton', countMode },
  })
  return { countMode }
}

// Haengt an jeden Log den Zaehlwert fuer calculateTrophies (lib/trophies.js).
export function withPoints(logs, countMode) {
  if (countMode !== 'weighted') return logs
  return logs.map(l => ({ ...l, points: l.weight ?? DEFAULT_DIFFICULTY }))
}

// ---------------------------------------------------------------------------
// Aufwand pro Aufgabe (Hooks fuer domain/tasks.js)
// ---------------------------------------------------------------------------

export function validateDifficulty(difficulty) {
  if (difficulty == null) return null
  return DIFFICULTIES.includes(difficulty) ? null : 'Ungültiger Aufwand'
}

// Felder fuer einen neuen Erledigungs-Log: Punkte werden beim Abhaken
// eingefroren, spaetere Aenderungen am Aufwand wirken nur noch kuenftig.
export function logWeightFields(task) {
  return { weight: DIFFICULTIES.includes(task.difficulty) ? task.difficulty : DEFAULT_DIFFICULTY }
}

// Alt-Eintraege von vor dem Feature (weightFromTask) folgen dem Aufwand ihrer
// Aufgabe - so stimmt die Statistik nach dem einmaligen Einstufen sofort.
export async function syncLegacyWeights(taskId, difficulty) {
  await prisma.taskLog.updateMany({
    where: { taskId, weightFromTask: true },
    data: { weight: difficulty },
  })
}

// ---------------------------------------------------------------------------
// Rechnen (rein, ohne DB - direkt testbar)
// ---------------------------------------------------------------------------

export function berlinDateOf(instant) {
  return new Date(instant).toLocaleDateString('sv-SE', { timeZone: TZ })
}

function daysBetween(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDaysToDateString(d, 1)) out.push(d)
  return out
}

// ISO-Kalenderwoche eines YYYY-MM-DD.
export function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = (date.getUTCDay() + 6) % 7 // Mo = 0
  date.setUTCDate(date.getUTCDate() - day + 3) // Donnerstag derselben Woche
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000))
}

// Ganze Prozente, die in Summe genau 100 ergeben (Methode des groessten
// Rests): abrunden, fehlende Punkte an die groessten Nachkommareste.
export function largestRemainder(values) {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map(v => (v / total) * 100)
  const floors = raw.map(Math.floor)
  let missing = 100 - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, rest: r - floors[i] }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (missing <= 0) break
    floors[i]++
    missing--
  }
  return floors
}

// Urlaubstage je Nutzer als Set von YYYY-MM-DD, begrenzt auf [from, today].
function vacationDaySets(vacations, from, today) {
  const sets = new Map()
  for (const v of vacations) {
    const start = v.startDate > from ? v.startDate : from
    const endRaw = v.endDate ?? today
    const end = endRaw < today ? endRaw : today
    if (start > end) continue
    if (!sets.has(v.userId)) sets.set(v.userId, new Set())
    const set = sets.get(v.userId)
    for (const d of daysBetween(start, end)) set.add(d)
  }
  return sets
}

function computePeriod({ from, to, minPresent, users, logsByUser, vacSets }) {
  const days = daysBetween(from, to)
  const candidates = []
  let totalPoints = 0

  for (const u of users) {
    const userLogs = (logsByUser.get(u.id) || []).filter(l => l.date >= from && l.date <= to)
    const points = userLogs.reduce((a, l) => a + l.weight, 0)
    if (points <= 0) continue
    totalPoints += points
    const vac = vacSets.get(u.id) || new Set()
    const activeDays = days.filter(d => d >= u.createdDate)
    const vacationDays = activeDays.filter(d => vac.has(d)).length
    const presentDays = activeDays.length - vacationDays
    candidates.push({
      id: u.id,
      name: u.name,
      points,
      count: userLogs.length,
      avgWeight: Math.round((points / userLogs.length) * 10) / 10,
      presentDays,
      vacationDays,
    })
  }

  const included = candidates.filter(c => c.presentDays >= minPresent)
  const mostlyAway = candidates
    .filter(c => c.presentDays < minPresent)
    .map(c => ({ id: c.id, name: c.name, reason: c.vacationDays > 0 ? 'vacation' : 'new' }))
  const shares = largestRemainder(included.map(c => c.points / c.presentDays))
  const persons = included.map((c, i) => ({ ...c, share: shares[i] }))

  return { from, to, totalPoints, persons, mostlyAway }
}

function spread(persons) {
  if (persons.length < 2) return null
  const s = persons.map(p => p.share)
  return Math.max(...s) - Math.min(...s)
}

// users: [{ id, name, createdAt }] (freigeschaltete Nutzer, nach createdAt)
// logs:  [{ completedBy, loggedAt, weight }] (nur zaehlende Erledigungen)
// vacations: [{ userId, startDate, endDate }]
export function computeFairness({ today, users, logs, vacations }) {
  const windowFrom = addDaysToDateString(today, -(WINDOW_DAYS - 1))
  const prevTo = addDaysToDateString(windowFrom, -1)
  const prevFrom = addDaysToDateString(prevTo, -(WINDOW_DAYS - 1))
  const thisMonday = mondayOnOrBefore(today)
  const weekRanges = []
  for (let k = WEEK_COUNT; k >= 1; k--) {
    const start = addDaysToDateString(thisMonday, -7 * k)
    weekRanges.push({ from: start, to: addDaysToDateString(start, 6) })
  }
  const earliest = [prevFrom, weekRanges[0].from].sort()[0]

  const preparedUsers = users.map(u => ({ id: u.id, name: u.name, createdDate: berlinDateOf(u.createdAt) }))
  const userIds = new Set(preparedUsers.map(u => u.id))
  const logsByUser = new Map()
  for (const l of logs) {
    if (!userIds.has(l.completedBy)) continue
    const date = berlinDateOf(l.loggedAt)
    if (date < earliest || date > today) continue
    if (!logsByUser.has(l.completedBy)) logsByUser.set(l.completedBy, [])
    logsByUser.get(l.completedBy).push({ date, weight: l.weight })
  }
  const vacSets = vacationDaySets(vacations, earliest, today)
  const ctx = { users: preparedUsers, logsByUser, vacSets }

  const current = computePeriod({ ...ctx, from: windowFrom, to: today, minPresent: MIN_PRESENT_DAYS_WINDOW })
  const previous = computePeriod({ ...ctx, from: prevFrom, to: prevTo, minPresent: MIN_PRESENT_DAYS_WINDOW })
  const weeks = weekRanges.map(r => {
    const w = computePeriod({ ...ctx, ...r, minPresent: MIN_PRESENT_DAYS_WEEK })
    return {
      label: `KW ${isoWeek(r.from)}`,
      from: r.from,
      to: r.to,
      totalPoints: w.totalPoints,
      lowData: w.totalPoints < LOW_DATA_POINTS_WEEK,
      persons: w.persons.map(p => ({ id: p.id, name: p.name, share: p.share, points: p.points })),
      mostlyAway: w.mostlyAway,
    }
  })

  let trend = null
  const nowSpread = spread(current.persons)
  const prevSpread = previous.totalPoints > 0 ? spread(previous.persons) : null
  if (nowSpread != null && prevSpread != null) {
    const diff = nowSpread - prevSpread
    trend = diff <= -TREND_THRESHOLD ? 'more-balanced' : diff >= TREND_THRESHOLD ? 'less-balanced' : 'similar'
  }

  // Feste Reihenfolge (nach Konto-Anlage) fuer stabile Personenfarben.
  const appearing = new Set([
    ...current.persons.map(p => p.id),
    ...previous.persons.map(p => p.id),
    ...weeks.flatMap(w => w.persons.map(p => p.id)),
  ])
  const people = preparedUsers.filter(u => appearing.has(u.id)).map(u => ({ id: u.id, name: u.name }))

  return {
    today,
    window: { from: windowFrom, to: today },
    totalPoints: current.totalPoints,
    lowData: current.totalPoints < LOW_DATA_POINTS_WINDOW,
    persons: current.persons,
    mostlyAway: current.mostlyAway,
    previous: previous.totalPoints > 0 && previous.persons.length > 0
      ? { from: prevFrom, to: prevTo, persons: previous.persons.map(p => ({ id: p.id, name: p.name, share: p.share })) }
      : null,
    trend,
    weeks,
    people,
  }
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

export async function getFairness() {
  const today = todayString()
  const earliest = [
    addDaysToDateString(today, -(2 * WINDOW_DAYS - 1)),
    addDaysToDateString(mondayOnOrBefore(today), -7 * WEEK_COUNT),
  ].sort()[0]

  const [users, logs, vacations] = await Promise.all([
    prisma.user.findMany({
      where: { approved: true },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskLog.findMany({
      where: {
        status: 'completed',
        completedBy: { not: null },
        loggedAt: { gte: getUTCRangeForBerlinDay(earliest).gte },
        ...EXCLUDE_ONCE,
      },
      select: { completedBy: true, loggedAt: true, weight: true },
    }),
    prisma.vacationPeriod.findMany({
      where: { OR: [{ endDate: null }, { endDate: { gte: earliest } }] },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ])

  return computeFairness({ today, users, logs, vacations })
}

// ---------------------------------------------------------------------------
// Urlaubszeiten
// ---------------------------------------------------------------------------

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function dayCount(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1
}

function validateRange(startDate, endDate, { allowOpen = false } = {}) {
  if (!isValidDate(startDate)) return 'Ungültiges Startdatum'
  if (endDate == null) return allowOpen ? null : 'Enddatum ist erforderlich'
  if (!isValidDate(endDate)) return 'Ungültiges Enddatum'
  if (endDate < startDate) return 'Das Enddatum darf nicht vor dem Startdatum liegen'
  if (dayCount(startDate, endDate) > MAX_VACATION_DAYS) return 'Ein Urlaubszeitraum darf höchstens ein Jahr lang sein'
  return null
}

const OPEN_END = '9999-12-31'

async function assertNoOverlap(userId, startDate, endDate, excludeId = null) {
  const others = await prisma.vacationPeriod.findMany({
    where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { startDate: true, endDate: true },
  })
  const end = endDate ?? OPEN_END
  const clash = others.some(o => o.startDate <= end && startDate <= (o.endDate ?? OPEN_END))
  if (clash) throw httpError(400, 'Der Zeitraum überschneidet sich mit einer bestehenden Urlaubszeit')
}

function withDays(v, today) {
  const end = v.endDate ?? today
  return { ...v, days: end >= v.startDate ? dayCount(v.startDate, end) : 0 }
}

export async function listAdminUsers() {
  const today = todayString()
  const users = await prisma.user.findMany({
    where: { approved: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      showFairness: true,
      vacationPeriods: {
        orderBy: { startDate: 'desc' },
        take: 20,
        select: { id: true, startDate: true, endDate: true, source: true },
      },
    },
  })
  return users.map(u => ({
    id: u.id,
    name: u.name,
    showFairness: u.showFairness,
    vacations: u.vacationPeriods.map(v => withDays(v, today)),
  }))
}

export async function setVisibility(userId, showFairness) {
  if (typeof showFairness !== 'boolean') throw httpError(400, 'Ungültiger Wert')
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw httpError(404, 'Nutzer nicht gefunden')
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { showFairness },
    select: { id: true, showFairness: true },
  })
  return updated
}

export async function createVacation({ userId, startDate, endDate }) {
  const err = validateRange(startDate, endDate)
  if (err) throw httpError(400, err)
  const user = typeof userId === 'string' ? await prisma.user.findUnique({ where: { id: userId } }) : null
  if (!user) throw httpError(404, 'Nutzer nicht gefunden')
  await assertNoOverlap(userId, startDate, endDate)
  const created = await prisma.vacationPeriod.create({
    data: { userId, startDate, endDate, source: 'manual' },
    select: { id: true, userId: true, startDate: true, endDate: true, source: true },
  })
  return withDays(created, todayString())
}

export async function updateVacation(id, { startDate, endDate }) {
  const existing = await prisma.vacationPeriod.findUnique({ where: { id } })
  if (!existing) throw httpError(404, 'Urlaubszeit nicht gefunden')
  // Eine laufende (ueber den Urlaubsmodus gestartete) Urlaubszeit darf offen
  // bleiben; neu offen setzen geht nur ueber den Urlaubsmodus selbst.
  const err = validateRange(startDate, endDate, { allowOpen: existing.endDate == null })
  if (err) throw httpError(400, err)
  await assertNoOverlap(existing.userId, startDate, endDate ?? null, id)
  const updated = await prisma.vacationPeriod.update({
    where: { id },
    data: { startDate, endDate: endDate ?? null },
    select: { id: true, userId: true, startDate: true, endDate: true, source: true },
  })
  return withDays(updated, todayString())
}

export async function deleteVacation(id) {
  const existing = await prisma.vacationPeriod.findUnique({ where: { id } })
  if (!existing) throw httpError(404, 'Urlaubszeit nicht gefunden')
  await prisma.vacationPeriod.delete({ where: { id } })
  return { message: 'Gelöscht' }
}

// Hook fuer PUT /users/me/vacation. Tag des Ein- und des Ausschaltens zaehlen
// als normale Tage, Urlaubstage sind nur die vollen Tage dazwischen - daher
// Start = Einschalttag + 1 und Ende = Ausschalttag - 1.
export async function recordVacationToggle(userId, vacationMode) {
  if (!isFairnessEnabled()) return
  const today = todayString()
  const open = await prisma.vacationPeriod.findFirst({ where: { userId, endDate: null } })

  if (vacationMode) {
    if (open) return
    const startDate = addDaysToDateString(today, 1)
    // Ein bereits (z. B. vorab) eingetragener Zeitraum deckt den Start ab.
    const covering = await prisma.vacationPeriod.findFirst({
      where: { userId, startDate: { lte: startDate }, endDate: { gte: startDate } },
    })
    if (covering) return
    await prisma.vacationPeriod.create({ data: { userId, startDate, endDate: null, source: 'toggle' } })
    return
  }

  if (!open) return
  const endDate = addDaysToDateString(today, -1)
  if (endDate < open.startDate) {
    await prisma.vacationPeriod.delete({ where: { id: open.id } })
  } else {
    await prisma.vacationPeriod.update({ where: { id: open.id }, data: { endDate } })
  }
}
