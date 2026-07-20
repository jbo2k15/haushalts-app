// Task-Domänenlogik: Geschäftsregeln + Datenzugriff für Aufgaben, getrennt von
// der HTTP-Schicht (routes/tasks.js ist nur noch ein dünner Adapter). Funktionen
// geben reine Daten zurück und werfen bei Fehlern httpError(status, msg).
import prisma from '../lib/prisma.js'
import { broadcastTasksUpdated } from '../lib/sse.js'
import { httpError } from '../lib/httpError.js'
import {
  dateStringInBerlin,
  todayString,
  yesterdayString,
  twoDaysAgoString,
  currentWeekStart,
  currentMonthStart,
} from '../lib/dates.js'
import {
  validatePauseRange,
  setIndividualPause,
  getIndividualPausesForTasks,
  getGlobalPause,
  isPausedOnDay,
} from './pauses.js'

export const LOG_LIMIT = 100

export const VALID_TYPES = ['daily', 'weekly', 'monthly', 'once']
export const VALID_PRIORITIES = ['high', 'normal', 'low']
// Types where "erledigt" is a per-period counter (today / current week)
// rather than a single fixed date, so completing more than once per period
// makes sense (e.g. "Wäsche sortieren" — at least weekly, but fine more
// often). monthly/once tasks have a single natural due point, so multi-
// completion isn't offered for those.
export const MULTI_ELIGIBLE_TYPES = ['daily', 'weekly']

export function validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple, weatherDependent, pauseFrom, pauseTo }) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) return 'Titel ist erforderlich'
  if (title.length > 200) return 'Titel darf maximal 200 Zeichen haben'
  if (!VALID_TYPES.includes(type)) return 'Ungültiger Typ'
  if (priority && !VALID_PRIORITIES.includes(priority)) return 'Ungültige Priorität'
  if (Array.isArray(weekdays) && !weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return 'Ungültige Wochentage'
  if (fixedWeekday != null && !(Number.isInteger(fixedWeekday) && fixedWeekday >= 0 && fixedWeekday <= 6)) return 'Ungültiger Wochentag'
  if (fixedDayOfMonth != null && !(Number.isInteger(fixedDayOfMonth) && fixedDayOfMonth >= 1 && fixedDayOfMonth <= 31)) return 'Ungültiger Tag im Monat'
  if (type === 'once') {
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Fälligkeitsdatum ist erforderlich (YYYY-MM-DD)'
    // Das Regex allein lässt unmögliche Daten wie 2026-99-99 oder 2026-02-30
    // durch - gegen einen echten Kalender prüfen (Round-Trip: wenn Date die
    // Werte normalisiert/verschiebt, war das Datum ungültig).
    const [y, m, d] = dueDate.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return 'Ungültiges Fälligkeitsdatum'
  }
  if (allowMultiple && !MULTI_ELIGIBLE_TYPES.includes(type)) return '"Mehrfach erledigbar" ist nur für tägliche oder wöchentliche Aufgaben verfügbar'
  if (weatherDependent && type !== 'daily') return '"Wetterabhängig" ist nur für tägliche Aufgaben verfügbar'
  const pauseErr = validatePauseRange(pauseFrom, pauseTo)
  if (pauseErr) return pauseErr
  if ((pauseFrom || pauseTo) && type === 'once') return 'Pausenzeitraum ist für einmalige Aufgaben nicht verfügbar'
  return null
}

// Tagesübersicht (Home): aktive Aufgaben nach Typ gruppiert, mit Erledigt-/
// Überfällig-Status. Batcht die Completions in einer Query.
export async function getTaskOverview() {
  const today = todayString()
  const yesterday = yesterdayString()
  const twoDaysAgo = twoDaysAgoString()
  const todayBerlin = new Date(dateStringInBerlin(0))
  const todayWeekday = todayBerlin.getDay()
  const weekStart = currentWeekStart()
  const monthStart = currentMonthStart()

  const tasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }],
  })

  // Batch-fetch all completions in one query
  const taskIds = tasks.map(t => t.id)
  const onceDueDates = tasks.filter(t => t.type === 'once' && t.dueDate).map(t => t.dueDate)
  // Must cover the earliest of all three lookback windows (daily: 2 days,
  // weekly: current week, monthly: current month) — missing weekStart here
  // caused weekly completions to fall outside the fetched range (and thus
  // read back as "not completed") whenever the week started before both
  // monthStart and twoDaysAgo, e.g. early in a month on a Thu-Sun.
  const rangeStart = [monthStart, twoDaysAgo, weekStart].reduce((min, d) => (d < min ? d : min))

  // Deckt today UND die beiden Vortage ab, damit "gestern/vorgestern
  // abgelehnt" die Folgetag-Überfällig-Markierung genauso auflösen kann wie
  // eine echte Erledigung (siehe missedYesterday/missedTwoDaysAgo unten).
  const skippedLogs = taskIds.length === 0 ? [] : await prisma.taskLog.findMany({
    where: { taskId: { in: taskIds }, forDate: { gte: twoDaysAgo, lte: today }, status: 'skipped' },
    select: { taskId: true, forDate: true },
  })
  const skippedIds = new Set(skippedLogs.filter(l => l.forDate === today).map(l => l.taskId))
  const skippedDatesByTask = new Map()
  for (const l of skippedLogs) {
    if (!skippedDatesByTask.has(l.taskId)) skippedDatesByTask.set(l.taskId, new Set())
    skippedDatesByTask.get(l.taskId).add(l.forDate)
  }

  // Wetterabhängige Tagesaufgaben, die der stündliche(/15-Min-)Wetter-Check
  // bereits als "vom System erledigt" markiert hat (siehe services/weather.js) -
  // bewusst kein TaskCompletion, nur ein TaskLog-Eintrag, damit sie nicht in
  // Statistik/Trophäen/Fairness einfließen.
  const systemCompletedToday = taskIds.length === 0 ? [] : await prisma.taskLog.findMany({
    where: { taskId: { in: taskIds }, forDate: today, status: 'system-completed' },
    select: { taskId: true },
  })
  const systemCompletedIds = new Set(systemCompletedToday.map(l => l.taskId))

  const allCompletions = taskIds.length === 0 ? [] : await prisma.taskCompletion.findMany({
    where: {
      taskId: { in: taskIds },
      OR: [
        { forDate: { gte: rangeStart } },
        ...(onceDueDates.length ? [{ forDate: { in: onceDueDates } }] : []),
      ],
    },
    select: { taskId: true, forDate: true, user: { select: { name: true } } },
  })

  // O(1) lookup maps
  const byKey = new Map(allCompletions.map(c => [`${c.taskId}-${c.forDate}`, c]))
  const byTask = new Map()
  for (const c of allCompletions) {
    if (!byTask.has(c.taskId)) byTask.set(c.taskId, [])
    byTask.get(c.taskId).push(c)
  }

  const pausableTaskIds = tasks.filter(t => t.type !== 'once').map(t => t.id)
  const [individualPauseMap, globalPause] = await Promise.all([
    getIndividualPausesForTasks(pausableTaskIds),
    getGlobalPause(),
  ])
  const pauseSummary = {
    daily: { paused: 0, total: 0 },
    weekly: { paused: 0, total: 0 },
    monthly: { paused: 0, total: 0 },
  }

  const result = { once: [], daily: [], weekly: [], monthly: [] }

  const yesterdayWeekday = new Date(yesterday).getDay()
  const twoDaysAgoWeekday = new Date(twoDaysAgo).getDay()

  for (const task of tasks) {
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null

    if (task.type !== 'once') {
      pauseSummary[task.type].total++
      const pausedToday = isPausedOnDay(individualPauseMap.get(task.id), globalPause, today)
      if (pausedToday) {
        pauseSummary[task.type].paused++
        continue
      }
    }

    if (task.type === 'once') {
      if (!task.dueDate) continue
      const completion = byKey.get(`${task.id}-${task.dueDate}`) || null
      result.once.push({
        ...task,
        completed: !!completion,
        completedBy: completion?.user?.name || null,
        isOnce: true,
        isOverdue: !completion && task.dueDate < today,
      })
      continue
    }

    if (task.type === 'daily') {
      if (skippedIds.has(task.id)) continue

      const dueToday = !weekdays || weekdays.length === 0 || weekdays.includes(todayWeekday)

      const todaysCompletions = (byTask.get(task.id) || []).filter(c => c.forDate === today)
      const count = todaysCompletions.length
      const lastCompletion = todaysCompletions[todaysCompletions.length - 1] || null
      const taskCreatedDate = task.createdAt.toISOString().slice(0, 10)

      // Eine wochentagsbeschränkte Aufgabe, die an einem kürzlich fälligen Tag
      // nicht erledigt wurde, bleibt an den Folgetagen als "überfällig" sichtbar
      // (z.B. eine Dienstags-Aufgabe zeigt sich Mi/Do noch), bis sie erledigt
      // wird oder verfällt (~2 Tage, siehe Scheduler). Sie gilt als erledigt,
      // sobald es SEIT dem verpassten Tag IRGENDEINE Erledigung gibt - ein
      // Abhaken am Folgetag klärt sie also und sie taucht am nächsten Tag nicht
      // erneut auf. (Nur relevant, wenn heute kein regulärer Tag ist - an
      // regulären Tagen ist es einfach die heutige, offene Aufgabe.)
      const compDates = new Set((byTask.get(task.id) || []).map(c => c.forDate))
      const skippedDates = skippedDatesByTask.get(task.id) || new Set()
      const wasDueYesterday = taskCreatedDate <= yesterday && (!weekdays || weekdays.length === 0 || weekdays.includes(yesterdayWeekday))
      const wasDueTwoDaysAgo = taskCreatedDate <= twoDaysAgo && (!weekdays || weekdays.length === 0 || weekdays.includes(twoDaysAgoWeekday))
      // Ein explizites "Heute nicht nötig" (abgelehnt) am fälligen Tag klärt die
      // Überfälligkeit genauso wie eine Erledigung - sonst würde eine bewusst
      // abgelehnte wochentagsbeschränkte Aufgabe am Folgetag trotzdem als
      // überfällig markiert.
      const missedYesterday = wasDueYesterday && !compDates.has(yesterday) && !compDates.has(today) && !skippedDates.has(yesterday)
      const missedTwoDaysAgo = wasDueTwoDaysAgo && !compDates.has(twoDaysAgo) && !compDates.has(yesterday) && !compDates.has(today) && !skippedDates.has(twoDaysAgo)
      const isOverdue = !dueToday && (missedYesterday || missedTwoDaysAgo)

      const systemCompleted = systemCompletedIds.has(task.id)

      // Heute kein regulärer Tag, nichts Überfälliges UND heute nichts erledigt
      // -> ausblenden. (Wurde die überfällige Aufgabe heute abgehakt, bleibt sie
      // für den Rest des Tages als erledigt/durchgestrichen sichtbar, statt sofort
      // zu verschwinden.)
      if (!dueToday && !isOverdue && count === 0 && !systemCompleted) continue

      result.daily.push({
        ...task,
        weekdays,
        completed: count > 0 || systemCompleted,
        // count is only meaningful for allowMultiple tasks — normal daily
        // tasks stay a plain 0/1 toggle, so expose the flag either way and
        // let the frontend decide whether to render the counter/undo button.
        count: task.allowMultiple ? count : (count > 0 ? 1 : 0),
        completedBy: lastCompletion?.user?.name || null,
        isOverdue: isOverdue && !systemCompleted,
        systemCompleted,
      })
    }

    if (task.type === 'weekly') {
      const weekCompletions = (byTask.get(task.id) || []).filter(c => c.forDate === weekStart)
      const count = weekCompletions.length
      const lastCompletion = weekCompletions[weekCompletions.length - 1] || null
      result.weekly.push({
        ...task,
        completed: count > 0,
        count: task.allowMultiple ? count : (count > 0 ? 1 : 0),
        completedBy: lastCompletion?.user?.name || null,
      })
    }

    if (task.type === 'monthly') {
      const completion = byTask.get(task.id)?.find(c => c.forDate >= monthStart) || null
      result.monthly.push({
        ...task,
        completed: !!completion,
        completedBy: completion?.user?.name || null,
      })
    }
  }

  return { ...result, pauseSummary }
}

async function createCompletion({ taskId, taskTitle, forDate, userId, userName }) {
  return prisma.$transaction(async (tx) => {
    const completion = await tx.taskCompletion.create({ data: { taskId, completedBy: userId, forDate } })
    await tx.taskLog.create({
      data: { taskId, taskTitle, status: 'completed', completedBy: userId, userName, forDate, completionId: completion.id },
    })
    await tx.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    return completion
  })
}

export async function completeTask(id, { userId, userName }) {
  const today = todayString()
  const weekStart = currentWeekStart()
  const monthStart = currentMonthStart()

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw httpError(404, 'Aufgabe nicht gefunden')
  if (!task.isActive) throw httpError(400, 'Aufgabe ist nicht aktiv')

  let forDate = today
  if (task.type === 'weekly') forDate = weekStart
  if (task.type === 'monthly') forDate = monthStart
  if (task.type === 'once') forDate = task.dueDate

  // Daily/weekly tasks with allowMultiple: every click adds another
  // completion (undone separately via /uncomplete-last) — no toggle-off
  // here. Everything else keeps the original single toggle behavior below.
  if (MULTI_ELIGIBLE_TYPES.includes(task.type) && task.allowMultiple) {
    await createCompletion({ taskId: id, taskTitle: task.title, forDate, userId, userName })
    const count = await prisma.taskCompletion.count({ where: { taskId: id, forDate } })
    broadcastTasksUpdated()
    return { completed: true, count }
  }

  const existing = await prisma.taskCompletion.findFirst({ where: { taskId: id, forDate } })

  if (existing) {
    await prisma.taskCompletion.delete({ where: { id: existing.id } })
    await prisma.taskLog.deleteMany({ where: { taskId: id, forDate, status: 'completed' } })
    broadcastTasksUpdated()
    return { completed: false }
  }

  await createCompletion({ taskId: id, taskTitle: task.title, forDate, userId, userName })

  broadcastTasksUpdated()
  return { completed: true }
}

export async function uncompleteLast(id) {
  const today = todayString()
  const weekStart = currentWeekStart()

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || !MULTI_ELIGIBLE_TYPES.includes(task.type) || !task.allowMultiple) {
    throw httpError(400, 'Nur für mehrfach erledigbare tägliche oder wöchentliche Aufgaben verfügbar')
  }
  if (!task.isActive) throw httpError(400, 'Aufgabe ist nicht aktiv')

  const forDate = task.type === 'weekly' ? weekStart : today

  const last = await prisma.taskCompletion.findFirst({
    where: { taskId: id, forDate },
    orderBy: { completedAt: 'desc' },
  })
  if (!last) throw httpError(400, 'Keine Erledigung zum Zurücknehmen vorhanden')

  // Cascades to the linked TaskLog entry (see schema: TaskLog.completionId onDelete: Cascade)
  await prisma.taskCompletion.delete({ where: { id: last.id } })
  const count = await prisma.taskCompletion.count({ where: { taskId: id, forDate } })

  broadcastTasksUpdated()
  return { completed: count > 0, count }
}

export async function skipTask(id) {
  const today = todayString()
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || task.type !== 'daily') throw httpError(400, 'Nur tägliche Aufgaben können übersprungen werden')
  if (!task.isActive) throw httpError(400, 'Aufgabe ist nicht aktiv')

  const existing = await prisma.taskLog.findFirst({ where: { taskId: id, forDate: today, status: 'skipped' } })
  if (existing) {
    await prisma.taskLog.delete({ where: { id: existing.id } })
    return { skipped: false }
  }

  await prisma.taskLog.create({ data: { taskId: id, taskTitle: task.title, status: 'skipped', forDate: today } })
  broadcastTasksUpdated()
  return { skipped: true }
}

export async function getLog() {
  return prisma.taskLog.findMany({
    orderBy: { loggedAt: 'desc' },
    take: LOG_LIMIT,
    select: { id: true, taskId: true, taskTitle: true, status: true, userName: true, loggedAt: true },
  })
}

function getUTCRangeForBerlinDay(dateStr) {
  const noon = new Date(`${dateStr}T12:00:00Z`)
  const berlinHour = parseInt(noon.toLocaleString('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }))
  const offsetHours = berlinHour - 12
  const dayStart = new Date(`${dateStr}T00:00:00Z`)
  dayStart.setHours(dayStart.getHours() - offsetHours)
  const dayEnd = new Date(dayStart)
  dayEnd.setHours(dayEnd.getHours() + 24)
  return { gte: dayStart, lt: dayEnd }
}

const EXCLUDE_ONCE = { OR: [{ taskId: null }, { task: { type: { not: 'once' } } }] }

// Erledigte Logs pro Nutzer in einem Zeitfenster zählen - ein groupBy über
// completedBy statt je Nutzer eine eigene count-Query (früher 3×N Queries pro
// /stats-Aufruf, jetzt 3 unabhängig von der Nutzerzahl). completedBy: not null,
// weil groupBy sonst eine null-Gruppe (z.B. verfallene Logs) mitzählen würde.
async function completedCountsByUser(where) {
  const groups = await prisma.taskLog.groupBy({
    by: ['completedBy'],
    where: { status: 'completed', completedBy: { not: null }, ...EXCLUDE_ONCE, ...where },
    _count: true,
  })
  return Object.fromEntries(groups.map(g => [g.completedBy, g._count]))
}

export async function getStats() {
  const curWeekStart = currentWeekStart()
  const curMonthStart = currentMonthStart()
  const today = todayString()

  const [users, dayCounts, weekCounts, monthCounts] = await Promise.all([
    prisma.user.findMany({ where: { approved: true } }),
    completedCountsByUser({ loggedAt: getUTCRangeForBerlinDay(today) }),
    completedCountsByUser({ forDate: { gte: curWeekStart } }),
    completedCountsByUser({ forDate: { gte: curMonthStart } }),
  ])

  return users.map(u => ({
    id: u.id,
    name: u.name,
    curDay: dayCounts[u.id] || 0,
    curWeek: weekCounts[u.id] || 0,
    curMonth: monthCounts[u.id] || 0,
    dayTrophies: u.dayTrophies,
    weekTrophies: u.weekTrophies,
    monthTrophies: u.monthTrophies,
  }))
}

export async function listAdminTasks() {
  const tasks = await prisma.task.findMany({ orderBy: [{ sortOrder: 'asc' }] })
  const pauseMap = await getIndividualPausesForTasks(tasks.map(t => t.id))
  return tasks.map(t => ({
    ...t,
    weekdays: t.weekdays ? JSON.parse(t.weekdays) : null,
    pauseFrom: pauseMap.get(t.id)?.pauseFrom || null,
    pauseTo: pauseMap.get(t.id)?.pauseTo || null,
  }))
}

export async function exportTasks() {
  const tasks = await prisma.task.findMany({
    where: { isAutoGenerated: false },
    orderBy: [{ sortOrder: 'asc' }],
    select: { id: true, title: true, type: true, priority: true, weekdays: true, fixedWeekday: true, fixedDayOfMonth: true, dueDate: true, isActive: true, allowMultiple: true, weatherDependent: true },
  })
  const pauseMap = await getIndividualPausesForTasks(tasks.map(t => t.id))
  return tasks.map(({ id, ...t }) => ({
    ...t,
    weekdays: t.weekdays ? JSON.parse(t.weekdays) : null,
    pauseFrom: pauseMap.get(id)?.pauseFrom || null,
    pauseTo: pauseMap.get(id)?.pauseTo || null,
  }))
}

export async function importTasks(tasks, userId) {
  if (!Array.isArray(tasks) || tasks.length === 0) throw httpError(400, 'Ungültiges Format')
  if (tasks.length > 200) throw httpError(400, 'Maximal 200 Aufgaben pro Import')

  const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } })
  const nextOrder = (maxOrder._max.sortOrder || 0) + 1

  const valid = tasks.filter(t => !validateTaskInput(t))
  if (valid.length === 0) return { message: '0 Aufgaben importiert' }

  // createMany (SQLite) liefert keine erzeugten Zeilen zurück - für die
  // TaskPause-Zeilen brauchen wir aber die neuen Task-IDs, daher einzelne
  // create()-Aufrufe in einer Transaktion statt createMany.
  const created = await prisma.$transaction(valid.map((t, i) => prisma.task.create({
    data: {
      title: t.title.trim(),
      type: t.type,
      priority: t.priority || 'normal',
      weekdays: Array.isArray(t.weekdays) && t.weekdays.length ? JSON.stringify(t.weekdays) : null,
      fixedWeekday: Number.isInteger(t.fixedWeekday) ? t.fixedWeekday : null,
      fixedDayOfMonth: Number.isInteger(t.fixedDayOfMonth) ? t.fixedDayOfMonth : null,
      dueDate: t.type === 'once' && t.dueDate ? t.dueDate : null,
      isActive: t.isActive !== false,
      allowMultiple: MULTI_ELIGIBLE_TYPES.includes(t.type) && t.allowMultiple === true,
      weatherDependent: t.type === 'daily' && t.weatherDependent === true,
      sortOrder: nextOrder + i,
    },
  })))

  const pauseRows = created
    .map((task, i) => ({ task, input: valid[i] }))
    .filter(({ task, input }) => task.type !== 'once' && input.pauseFrom && input.pauseTo && !validatePauseRange(input.pauseFrom, input.pauseTo))
    .map(({ task, input }) => ({ taskId: task.id, pauseFrom: input.pauseFrom, pauseTo: input.pauseTo, createdBy: userId || null }))
  if (pauseRows.length) await prisma.taskPause.createMany({ data: pauseRows })

  return { message: `${valid.length} Aufgaben importiert` }
}

export async function createTask(body, userId) {
  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive, allowMultiple, weatherDependent, pauseFrom, pauseTo } = body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple, weatherDependent, pauseFrom, pauseTo })
  if (err) throw httpError(400, err)

  const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } })
  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      type,
      priority: priority || 'normal',
      weekdays: Array.isArray(weekdays) && weekdays.length ? JSON.stringify(weekdays) : null,
      fixedWeekday: fixedWeekday ?? null,
      fixedDayOfMonth: fixedDayOfMonth ?? null,
      dueDate: type === 'once' ? dueDate : null,
      isActive: isActive !== false,
      allowMultiple: MULTI_ELIGIBLE_TYPES.includes(type) && allowMultiple === true,
      weatherDependent: type === 'daily' && weatherDependent === true,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
    },
  })
  await setIndividualPause(task.id, { pauseFrom: type !== 'once' ? pauseFrom : null, pauseTo: type !== 'once' ? pauseTo : null }, userId)
  return task
}

export async function updateTask(id, body, userId) {
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw httpError(404, 'Aufgabe nicht gefunden')
  if (task.isAutoGenerated) throw httpError(403, 'Auto-generierte Aufgaben können nicht bearbeitet werden')

  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive, allowMultiple, weatherDependent, pauseFrom, pauseTo } = body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple, weatherDependent, pauseFrom, pauseTo })
  if (err) throw httpError(400, err)

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: title.trim(),
      type,
      // Gleiche Defaults wie createTask, damit ein Body ohne priority/isActive
      // keinen undefinierten Wert durchreicht.
      priority: priority || 'normal',
      weekdays: Array.isArray(weekdays) && weekdays.length ? JSON.stringify(weekdays) : null,
      fixedWeekday: fixedWeekday ?? null,
      fixedDayOfMonth: fixedDayOfMonth ?? null,
      dueDate: type === 'once' ? dueDate : null,
      isActive: isActive !== false,
      allowMultiple: MULTI_ELIGIBLE_TYPES.includes(type) && allowMultiple === true,
      weatherDependent: type === 'daily' && weatherDependent === true,
    },
  })
  await setIndividualPause(updated.id, { pauseFrom: type !== 'once' ? pauseFrom : null, pauseTo: type !== 'once' ? pauseTo : null }, userId)
  return updated
}

export async function deleteTask(id) {
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) throw httpError(404, 'Aufgabe nicht gefunden')
  // Active auto-generated tasks stay under the calendar sync's control —
  // deleting one wouldn't stick anyway since the next sync recreates it as
  // long as it's still upcoming in the feed. Once expired (isActive: false)
  // it's just clutter and can be removed manually.
  if (task.isAutoGenerated && task.isActive) {
    throw httpError(403, 'Aktive Abfallkalender-Aufgaben werden über den Kalender-Sync verwaltet')
  }
  await prisma.task.delete({ where: { id } })
  return { message: 'Gelöscht' }
}

export async function reorderTasks(body) {
  const { orderedIds } = body
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw httpError(400, 'Ungültige Reihenfolge')
  }
  if (orderedIds.length > 500) {
    throw httpError(400, 'Zu viele Aufgaben-IDs')
  }
  if (!orderedIds.every(id => typeof id === 'string' && id.length > 0)) {
    throw httpError(400, 'Ungültige Aufgaben-IDs')
  }

  // Verify all IDs exist in the database before updating
  const existing = await prisma.task.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  })
  if (existing.length !== orderedIds.length) {
    throw httpError(400, 'Unbekannte Aufgaben-ID in der Reihenfolge')
  }

  try {
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.task.update({ where: { id }, data: { sortOrder: i } }))
    )
    return { message: 'Reihenfolge gespeichert' }
  } catch {
    throw httpError(400, 'Fehler beim Speichern der Reihenfolge')
  }
}
