import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

const TZ = 'Europe/Berlin'

function dateStringInBerlin(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE', { timeZone: TZ })
}

function todayString() { return dateStringInBerlin(0) }
function yesterdayString() { return dateStringInBerlin(-1) }
function twoDaysAgoString() { return dateStringInBerlin(-2) }

function currentWeekStart() {
  const today = new Date(dateStringInBerlin(0))
  const day = today.getDay()
  const diff = (day + 6) % 7
  today.setDate(today.getDate() - diff)
  return today.toISOString().slice(0, 10)
}

function currentMonthStart() {
  return dateStringInBerlin(0).slice(0, 7) + '-01'
}

router.get('/', requireAuth, async (req, res) => {
  const today = todayString()
  const yesterday = yesterdayString()
  const twoDaysAgo = twoDaysAgoString()
  const todayBerlin = new Date(dateStringInBerlin(0))
  const todayWeekday = todayBerlin.getDay()
  const todayDayOfMonth = todayBerlin.getDate()
  const weekStart = currentWeekStart()
  const monthStart = currentMonthStart()

  const tasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }],
  })

  const result = { daily: [], weekly: [], monthly: [] }

  for (const task of tasks) {
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null

    if (task.type === 'daily') {
      if (weekdays && weekdays.length > 0 && !weekdays.includes(todayWeekday)) continue

      const completionToday = await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: today } },
        include: { user: true },
      })

      const taskCreatedDate = task.createdAt.toISOString().slice(0, 10)
      const yesterdayWeekday = new Date(yesterday).getDay()
      const twoDaysAgoWeekday = new Date(twoDaysAgo).getDay()
      const wasDueYesterday = taskCreatedDate <= yesterday && (!weekdays || weekdays.length === 0 || weekdays.includes(yesterdayWeekday))
      const wasDueTwoDaysAgo = taskCreatedDate <= twoDaysAgo && (!weekdays || weekdays.length === 0 || weekdays.includes(twoDaysAgoWeekday))

      const completionYesterday = wasDueYesterday ? await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: yesterday } },
      }) : { id: 'not-due' }

      const completionTwoDaysAgo = wasDueTwoDaysAgo ? await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: twoDaysAgo } },
      }) : { id: 'not-due' }

      result.daily.push({
        ...task,
        weekdays: weekdays,
        completed: !!completionToday,
        completedBy: completionToday?.user?.name || null,
        overdueDay1: wasDueYesterday && !completionYesterday,
        overdueDay2: wasDueTwoDaysAgo && !completionTwoDaysAgo,
      })
    }

    if (task.type === 'weekly') {
      const completion = await prisma.taskCompletion.findFirst({
        where: { taskId: task.id, forDate: { gte: weekStart } },
        include: { user: true },
      })
      result.weekly.push({
        ...task,
        completed: !!completion,
        completedBy: completion?.user?.name || null,
      })
    }

    if (task.type === 'monthly') {
      const completion = await prisma.taskCompletion.findFirst({
        where: { taskId: task.id, forDate: { gte: monthStart } },
        include: { user: true },
      })
      result.monthly.push({
        ...task,
        completed: !!completion,
        completedBy: completion?.user?.name || null,
      })
    }
  }

  res.json(result)
})

router.post('/:id/complete', requireAuth, async (req, res) => {
  const { id } = req.params
  const today = todayString()
  const weekStart = currentWeekStart()
  const monthStart = currentMonthStart()

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })

  let forDate = today
  if (task.type === 'weekly') forDate = weekStart
  if (task.type === 'monthly') forDate = monthStart

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_forDate: { taskId: id, forDate } },
  })

  if (existing) {
    await prisma.taskCompletion.delete({ where: { taskId_forDate: { taskId: id, forDate } } })
    await prisma.taskLog.deleteMany({ where: { taskId: id, forDate, status: 'completed' } })
    return res.json({ completed: false })
  }

  await prisma.taskCompletion.create({
    data: { taskId: id, completedBy: req.user.id, forDate },
  })
  await prisma.user.update({ where: { id: req.user.id }, data: { lastActiveAt: new Date() } })
  await prisma.taskLog.create({
    data: {
      taskId: id,
      taskTitle: task.title,
      status: 'completed',
      completedBy: req.user.id,
      userName: req.user.name,
      forDate,
    },
  })

  return res.json({ completed: true })
})

router.get('/log', requireAuth, async (req, res) => {
  const logs = await prisma.taskLog.findMany({
    orderBy: { loggedAt: 'desc' },
    take: 100,
  })
  res.json(logs)
})

router.get('/stats', requireAuth, async (req, res) => {
  const now = new Date()

  // Aktuelle Woche (Mo–So)
  const curWeekStart = currentWeekStart()
  const curWeekEnd = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() + 6)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // Letzte Woche
  const lastWeekStart = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() - 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const lastWeekEnd = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // Aktueller Monat
  const curMonthStart = currentMonthStart()
  const curMonthEnd = (() => {
    const todayBerlin = new Date(dateStringInBerlin(0))
    const lastDay = new Date(todayBerlin.getFullYear(), todayBerlin.getMonth() + 1, 0).getDate()
    return `${todayBerlin.getFullYear()}-${String(todayBerlin.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })()

  // Letzter Monat
  const lastMonthEnd = (() => {
    const todayBerlin = new Date(dateStringInBerlin(0))
    const lastDay = new Date(todayBerlin.getFullYear(), todayBerlin.getMonth(), 0).getDate()
    return `${todayBerlin.getFullYear()}-${String(todayBerlin.getMonth()).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })()
  const lastMonthStart = (() => {
    const todayBerlin = new Date(dateStringInBerlin(0))
    const d = new Date(todayBerlin.getFullYear(), todayBerlin.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  const users = await prisma.user.findMany({ where: { approved: true } })

  const today = todayString()

  function berlinDayUTCRange(dateStr) {
    // Compute the UTC timestamps for start and end of a Berlin calendar day
    // This handles both MEZ (UTC+1) and MESZ (UTC+2) correctly
    const noon = new Date(`${dateStr}T12:00:00Z`)
    const berlinHour = parseInt(noon.toLocaleString('en-US', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }))
    const offsetHours = berlinHour - 12
    const dayStart = new Date(`${dateStr}T00:00:00Z`)
    dayStart.setHours(dayStart.getHours() - offsetHours)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(dayEnd.getHours() + 24)
    return { gte: dayStart, lt: dayEnd }
  }

  async function countCompletedOn(userId, date) {
    return prisma.taskLog.count({
      where: { completedBy: userId, status: 'completed', loggedAt: berlinDayUTCRange(date) },
    })
  }

  async function countFor(userId, from, to) {
    return prisma.taskLog.count({
      where: { completedBy: userId, status: 'completed', forDate: { gte: from, lte: to } },
    })
  }

  const userStats = await Promise.all(users.map(async (u) => ({
    id: u.id,
    name: u.name,
    curDay: await countCompletedOn(u.id, today),
    curWeek: await countFor(u.id, curWeekStart, curWeekEnd),
    lastWeek: await countFor(u.id, lastWeekStart, lastWeekEnd),
    curMonth: await countFor(u.id, curMonthStart, curMonthEnd),
    lastMonth: await countFor(u.id, lastMonthStart, lastMonthEnd),
  })))

  // Trophäen aus allen abgeschlossenen Perioden berechnen
  const allLogs = await prisma.taskLog.findMany({
    where: { status: 'completed', completedBy: { not: null } },
    select: { completedBy: true, forDate: true },
  })

  const dayTrophies = {}
  const weekTrophies = {}
  const monthTrophies = {}
  users.forEach(u => { dayTrophies[u.id] = 0; weekTrophies[u.id] = 0; monthTrophies[u.id] = 0 })

  // Tage gruppieren (ohne heute)
  const byDay = {}
  for (const log of allLogs) {
    if (log.forDate >= today) continue
    if (!byDay[log.forDate]) byDay[log.forDate] = {}
    byDay[log.forDate][log.completedBy] = (byDay[log.forDate][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(byDay)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) dayTrophies[winners[0][0]] = (dayTrophies[winners[0][0]] || 0) + 1
  }

  // Wochen gruppieren (ohne laufende Woche)
  const byWeek = {}
  for (const log of allLogs) {
    const d = new Date(log.forDate)
    const diff = (d.getDay() + 6) % 7
    const mon = new Date(d)
    mon.setDate(d.getDate() - diff)
    const wk = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
    if (wk >= curWeekStart) continue
    if (!byWeek[wk]) byWeek[wk] = {}
    byWeek[wk][log.completedBy] = (byWeek[wk][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(byWeek)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) weekTrophies[winners[0][0]] = (weekTrophies[winners[0][0]] || 0) + 1
  }

  // Monate gruppieren (ohne laufenden Monat)
  const byMonth = {}
  for (const log of allLogs) {
    const mo = log.forDate.slice(0, 7)
    if (mo >= curMonthStart.slice(0, 7)) continue
    if (!byMonth[mo]) byMonth[mo] = {}
    byMonth[mo][log.completedBy] = (byMonth[mo][log.completedBy] || 0) + 1
  }
  for (const counts of Object.values(byMonth)) {
    const max = Math.max(...Object.values(counts))
    if (max === 0) continue
    const winners = Object.entries(counts).filter(([, v]) => v === max)
    if (winners.length === 1) monthTrophies[winners[0][0]] = (monthTrophies[winners[0][0]] || 0) + 1
  }

  const result = userStats.map(u => ({
    ...u,
    dayTrophies: dayTrophies[u.id] || 0,
    weekTrophies: weekTrophies[u.id] || 0,
    monthTrophies: monthTrophies[u.id] || 0,
  }))

  res.json(result)
})

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: [{ sortOrder: 'asc' }] })
  res.json(tasks.map(t => ({ ...t, weekdays: t.weekdays ? JSON.parse(t.weekdays) : null })))
})

const VALID_TYPES = ['daily', 'weekly', 'monthly']
const VALID_PRIORITIES = ['high', 'normal', 'low']

function validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth }) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) return 'Titel ist erforderlich'
  if (title.length > 200) return 'Titel darf maximal 200 Zeichen haben'
  if (!VALID_TYPES.includes(type)) return 'Ungültiger Typ'
  if (priority && !VALID_PRIORITIES.includes(priority)) return 'Ungültige Priorität'
  if (Array.isArray(weekdays) && !weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return 'Ungültige Wochentage'
  if (fixedWeekday != null && !(Number.isInteger(fixedWeekday) && fixedWeekday >= 0 && fixedWeekday <= 6)) return 'Ungültiger Wochentag'
  if (fixedDayOfMonth != null && !(Number.isInteger(fixedDayOfMonth) && fixedDayOfMonth >= 1 && fixedDayOfMonth <= 31)) return 'Ungültiger Tag im Monat'
  return null
}

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, isActive } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth })
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
      isActive: isActive !== false,
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

  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, isActive } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth })
  if (err) return res.status(400).json({ error: err })

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: title.trim(),
      type,
      priority,
      weekdays: Array.isArray(weekdays) && weekdays.length ? JSON.stringify(weekdays) : null,
      fixedWeekday: fixedWeekday ?? null,
      fixedDayOfMonth: fixedDayOfMonth ?? null,
      isActive,
    },
  })
  res.json(updated)
})

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } })
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' })
  if (task.isAutoGenerated) return res.status(403).json({ error: 'Auto-generierte Aufgaben können nicht gelöscht werden' })
  await prisma.task.delete({ where: { id: req.params.id } })
  res.json({ message: 'Gelöscht' })
})

router.post('/admin/reorder', requireAuth, requireAdmin, async (req, res) => {
  const { orderedIds } = req.body
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return res.status(400).json({ error: 'Ungültige Reihenfolge' })
  }
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.task.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } })
    }
    res.json({ message: 'Reihenfolge gespeichert' })
  } catch {
    res.status(400).json({ error: 'Ungültige Aufgaben-ID in der Reihenfolge' })
  }
})

export default router
