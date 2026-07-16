import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { broadcastTasksUpdated } from '../lib/sse.js'
import {
  dateStringInBerlin,
  todayString,
  yesterdayString,
  twoDaysAgoString,
  currentWeekStart,
  currentMonthStart,
} from '../lib/dates.js'

const router = Router()

const LOG_LIMIT = 100

const VALID_TYPES = ['daily', 'weekly', 'monthly', 'once']
const VALID_PRIORITIES = ['high', 'normal', 'low']
// Types where "erledigt" is a per-period counter (today / current week)
// rather than a single fixed date, so completing more than once per period
// makes sense (e.g. "Wäsche sortieren" — at least weekly, but fine more
// often). monthly/once tasks have a single natural due point, so multi-
// completion isn't offered for those.
const MULTI_ELIGIBLE_TYPES = ['daily', 'weekly']

export function validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple }) {
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
  return null
}

router.get('/', requireAuth, async (req, res) => {
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

  const skippedToday = taskIds.length === 0 ? [] : await prisma.taskLog.findMany({
    where: { taskId: { in: taskIds }, forDate: today, status: 'skipped' },
    select: { taskId: true },
  })
  const skippedIds = new Set(skippedToday.map(l => l.taskId))

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

  const result = { once: [], daily: [], weekly: [], monthly: [] }

  const yesterdayWeekday = new Date(yesterday).getDay()
  const twoDaysAgoWeekday = new Date(twoDaysAgo).getDay()

  for (const task of tasks) {
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null

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
      const wasDueYesterday = taskCreatedDate <= yesterday && (!weekdays || weekdays.length === 0 || weekdays.includes(yesterdayWeekday))
      const wasDueTwoDaysAgo = taskCreatedDate <= twoDaysAgo && (!weekdays || weekdays.length === 0 || weekdays.includes(twoDaysAgoWeekday))
      const missedYesterday = wasDueYesterday && !compDates.has(yesterday) && !compDates.has(today)
      const missedTwoDaysAgo = wasDueTwoDaysAgo && !compDates.has(twoDaysAgo) && !compDates.has(yesterday) && !compDates.has(today)
      const isOverdue = !dueToday && (missedYesterday || missedTwoDaysAgo)

      // Heute kein regulärer Tag, nichts Überfälliges UND heute nichts erledigt
      // -> ausblenden. (Wurde die überfällige Aufgabe heute abgehakt, bleibt sie
      // für den Rest des Tages als erledigt/durchgestrichen sichtbar, statt sofort
      // zu verschwinden.)
      if (!dueToday && !isOverdue && count === 0) continue

      result.daily.push({
        ...task,
        weekdays,
        completed: count > 0,
        // count is only meaningful for allowMultiple tasks — normal daily
        // tasks stay a plain 0/1 toggle, so expose the flag either way and
        // let the frontend decide whether to render the counter/undo button.
        count: task.allowMultiple ? count : (count > 0 ? 1 : 0),
        completedBy: lastCompletion?.user?.name || null,
        isOverdue,
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

  res.set('Cache-Control', 'no-cache')
  res.json(result)
})

async function createCompletion(prisma, { taskId, taskTitle, forDate, userId, userName }) {
  return prisma.$transaction(async (tx) => {
    const completion = await tx.taskCompletion.create({ data: { taskId, completedBy: userId, forDate } })
    await tx.taskLog.create({
      data: { taskId, taskTitle, status: 'completed', completedBy: userId, userName, forDate, completionId: completion.id },
    })
    await tx.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    return completion
  })
}

router.post('/:id/complete', requireAuth, async (req, res) => {
  const { id } = req.params
  const today = todayString()
  const weekStart = currentWeekStart()
  const monthStart = currentMonthStart()

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })
  if (!task.isActive) return res.status(400).json({ error: 'Aufgabe ist nicht aktiv' })

  let forDate = today
  if (task.type === 'weekly') forDate = weekStart
  if (task.type === 'monthly') forDate = monthStart
  if (task.type === 'once') forDate = task.dueDate

  // Daily/weekly tasks with allowMultiple: every click adds another
  // completion (undone separately via /uncomplete-last) — no toggle-off
  // here. Everything else keeps the original single toggle behavior below.
  if (MULTI_ELIGIBLE_TYPES.includes(task.type) && task.allowMultiple) {
    await createCompletion(prisma, { taskId: id, taskTitle: task.title, forDate, userId: req.user.id, userName: req.user.name })
    const count = await prisma.taskCompletion.count({ where: { taskId: id, forDate } })
    broadcastTasksUpdated()
    return res.json({ completed: true, count })
  }

  const existing = await prisma.taskCompletion.findFirst({ where: { taskId: id, forDate } })

  if (existing) {
    await prisma.taskCompletion.delete({ where: { id: existing.id } })
    await prisma.taskLog.deleteMany({ where: { taskId: id, forDate, status: 'completed' } })
    broadcastTasksUpdated()
    return res.json({ completed: false })
  }

  await createCompletion(prisma, { taskId: id, taskTitle: task.title, forDate, userId: req.user.id, userName: req.user.name })

  broadcastTasksUpdated()
  return res.json({ completed: true })
})

router.post('/:id/uncomplete-last', requireAuth, async (req, res) => {
  const { id } = req.params
  const today = todayString()
  const weekStart = currentWeekStart()

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || !MULTI_ELIGIBLE_TYPES.includes(task.type) || !task.allowMultiple) {
    return res.status(400).json({ error: 'Nur für mehrfach erledigbare tägliche oder wöchentliche Aufgaben verfügbar' })
  }
  if (!task.isActive) return res.status(400).json({ error: 'Aufgabe ist nicht aktiv' })

  const forDate = task.type === 'weekly' ? weekStart : today

  const last = await prisma.taskCompletion.findFirst({
    where: { taskId: id, forDate },
    orderBy: { completedAt: 'desc' },
  })
  if (!last) return res.status(400).json({ error: 'Keine Erledigung zum Zurücknehmen vorhanden' })

  // Cascades to the linked TaskLog entry (see schema: TaskLog.completionId onDelete: Cascade)
  await prisma.taskCompletion.delete({ where: { id: last.id } })
  const count = await prisma.taskCompletion.count({ where: { taskId: id, forDate } })

  broadcastTasksUpdated()
  res.json({ completed: count > 0, count })
})

router.post('/:id/skip', requireAuth, async (req, res) => {
  const { id } = req.params
  const today = todayString()
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task || task.type !== 'daily') return res.status(400).json({ error: 'Nur tägliche Aufgaben können übersprungen werden' })
  if (!task.isActive) return res.status(400).json({ error: 'Aufgabe ist nicht aktiv' })

  const existing = await prisma.taskLog.findFirst({ where: { taskId: id, forDate: today, status: 'skipped' } })
  if (existing) {
    await prisma.taskLog.delete({ where: { id: existing.id } })
    return res.json({ skipped: false })
  }

  await prisma.taskLog.create({ data: { taskId: id, taskTitle: task.title, status: 'skipped', forDate: today } })
  broadcastTasksUpdated()
  return res.json({ skipped: true })
})

router.get('/log', requireAuth, async (req, res) => {
  const logs = await prisma.taskLog.findMany({
    orderBy: { loggedAt: 'desc' },
    take: LOG_LIMIT,
    select: { id: true, taskId: true, taskTitle: true, status: true, userName: true, loggedAt: true },
  })
  res.json(logs)
})

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

router.get('/stats', requireAuth, async (req, res) => {
  const curWeekStart = currentWeekStart()
  const curMonthStart = currentMonthStart()
  const today = todayString()

  const [users, dayCounts, weekCounts, monthCounts] = await Promise.all([
    prisma.user.findMany({ where: { approved: true } }),
    completedCountsByUser({ loggedAt: getUTCRangeForBerlinDay(today) }),
    completedCountsByUser({ forDate: { gte: curWeekStart } }),
    completedCountsByUser({ forDate: { gte: curMonthStart } }),
  ])

  res.json(users.map(u => ({
    id: u.id,
    name: u.name,
    curDay: dayCounts[u.id] || 0,
    curWeek: weekCounts[u.id] || 0,
    curMonth: monthCounts[u.id] || 0,
    dayTrophies: u.dayTrophies,
    weekTrophies: u.weekTrophies,
    monthTrophies: u.monthTrophies,
  })))
})

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: [{ sortOrder: 'asc' }] })
  res.json(tasks.map(t => ({ ...t, weekdays: t.weekdays ? JSON.parse(t.weekdays) : null })))
})

router.get('/admin/export', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { isAutoGenerated: false },
    orderBy: [{ sortOrder: 'asc' }],
    select: { title: true, type: true, priority: true, weekdays: true, fixedWeekday: true, fixedDayOfMonth: true, dueDate: true, isActive: true, allowMultiple: true },
  })
  const exportData = tasks.map(t => ({ ...t, weekdays: t.weekdays ? JSON.parse(t.weekdays) : null }))
  res.setHeader('Content-Disposition', 'attachment; filename="aufgaben.json"')
  res.setHeader('Content-Type', 'application/json')
  res.json(exportData)
})

router.post('/admin/import', requireAuth, requireAdmin, async (req, res) => {
  const tasks = req.body
  if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: 'Ungültiges Format' })
  if (tasks.length > 200) return res.status(400).json({ error: 'Maximal 200 Aufgaben pro Import' })

  const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } })
  let nextOrder = (maxOrder._max.sortOrder || 0) + 1

  const valid = tasks.filter(t => !validateTaskInput(t))
  if (valid.length === 0) return res.json({ message: '0 Aufgaben importiert' })

  await prisma.task.createMany({
    data: valid.map((t, i) => ({
      title: t.title.trim(),
      type: t.type,
      priority: t.priority || 'normal',
      weekdays: Array.isArray(t.weekdays) && t.weekdays.length ? JSON.stringify(t.weekdays) : null,
      fixedWeekday: Number.isInteger(t.fixedWeekday) ? t.fixedWeekday : null,
      fixedDayOfMonth: Number.isInteger(t.fixedDayOfMonth) ? t.fixedDayOfMonth : null,
      dueDate: t.type === 'once' && t.dueDate ? t.dueDate : null,
      isActive: t.isActive !== false,
      allowMultiple: MULTI_ELIGIBLE_TYPES.includes(t.type) && t.allowMultiple === true,
      sortOrder: nextOrder + i,
    })),
  })
  res.json({ message: `${valid.length} Aufgaben importiert` })
})

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive, allowMultiple } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple })
  if (err) return res.status(400).json({ error: err })

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
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
    },
  })
  res.json(task)
})

router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })
  if (task.isAutoGenerated) return res.status(403).json({ error: 'Auto-generierte Aufgaben können nicht bearbeitet werden' })

  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive, allowMultiple } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, allowMultiple })
  if (err) return res.status(400).json({ error: err })

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: title.trim(),
      type,
      // Gleiche Defaults wie POST /admin, damit ein Body ohne priority/isActive
      // keinen undefinierten Wert durchreicht.
      priority: priority || 'normal',
      weekdays: Array.isArray(weekdays) && weekdays.length ? JSON.stringify(weekdays) : null,
      fixedWeekday: fixedWeekday ?? null,
      fixedDayOfMonth: fixedDayOfMonth ?? null,
      dueDate: type === 'once' ? dueDate : null,
      isActive: isActive !== false,
      allowMultiple: MULTI_ELIGIBLE_TYPES.includes(type) && allowMultiple === true,
    },
  })
  res.json(updated)
})

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } })
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })
  // Active auto-generated tasks stay under the calendar sync's control —
  // deleting one wouldn't stick anyway since the next sync recreates it as
  // long as it's still upcoming in the feed. Once expired (isActive: false)
  // it's just clutter and can be removed manually.
  if (task.isAutoGenerated && task.isActive) {
    return res.status(403).json({ error: 'Aktive Abfallkalender-Aufgaben werden über den Kalender-Sync verwaltet' })
  }
  await prisma.task.delete({ where: { id: req.params.id } })
  res.json({ message: 'Gelöscht' })
})

router.post('/admin/reorder', requireAuth, requireAdmin, async (req, res) => {
  const { orderedIds } = req.body
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'Ungültige Reihenfolge' })
  }
  if (orderedIds.length > 500) {
    return res.status(400).json({ error: 'Zu viele Aufgaben-IDs' })
  }
  if (!orderedIds.every(id => typeof id === 'string' && id.length > 0)) {
    return res.status(400).json({ error: 'Ungültige Aufgaben-IDs' })
  }

  // Verify all IDs exist in the database before updating
  const existing = await prisma.task.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  })
  if (existing.length !== orderedIds.length) {
    return res.status(400).json({ error: 'Unbekannte Aufgaben-ID in der Reihenfolge' })
  }

  try {
    await prisma.$transaction(
      orderedIds.map((id, i) => prisma.task.update({ where: { id }, data: { sortOrder: i } }))
    )
    res.json({ message: 'Reihenfolge gespeichert' })
  } catch {
    res.status(400).json({ error: 'Fehler beim Speichern der Reihenfolge' })
  }
})

export default router
