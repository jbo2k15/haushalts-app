import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
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

function validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate }) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) return 'Titel ist erforderlich'
  if (title.length > 200) return 'Titel darf maximal 200 Zeichen haben'
  if (!VALID_TYPES.includes(type)) return 'Ungültiger Typ'
  if (priority && !VALID_PRIORITIES.includes(priority)) return 'Ungültige Priorität'
  if (Array.isArray(weekdays) && !weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return 'Ungültige Wochentage'
  if (fixedWeekday != null && !(Number.isInteger(fixedWeekday) && fixedWeekday >= 0 && fixedWeekday <= 6)) return 'Ungültiger Wochentag'
  if (fixedDayOfMonth != null && !(Number.isInteger(fixedDayOfMonth) && fixedDayOfMonth >= 1 && fixedDayOfMonth <= 31)) return 'Ungültiger Tag im Monat'
  if (type === 'once') {
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Fälligkeitsdatum ist erforderlich (YYYY-MM-DD)'
  }
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

  const result = { once: [], daily: [], weekly: [], monthly: [] }

  for (const task of tasks) {
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null

    if (task.type === 'once') {
      if (!task.dueDate) continue
      const completion = await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: task.dueDate } },
        include: { user: true },
      })
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
  if (task.type === 'once') forDate = task.dueDate

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_forDate: { taskId: id, forDate } },
  })

  if (existing) {
    await prisma.taskCompletion.delete({ where: { taskId_forDate: { taskId: id, forDate } } })
    await prisma.taskLog.deleteMany({ where: { taskId: id, forDate, status: 'completed' } })
    return res.json({ completed: false })
  }

  await prisma.$transaction([
    prisma.taskCompletion.create({ data: { taskId: id, completedBy: req.user.id, forDate } }),
    prisma.taskLog.create({ data: { taskId: id, taskTitle: task.title, status: 'completed', completedBy: req.user.id, userName: req.user.name, forDate } }),
    prisma.user.update({ where: { id: req.user.id }, data: { lastActiveAt: new Date() } }),
  ])

  return res.json({ completed: true })
})

router.get('/log', requireAuth, async (req, res) => {
  const logs = await prisma.taskLog.findMany({
    orderBy: { loggedAt: 'desc' },
    take: LOG_LIMIT,
  })
  res.json(logs)
})

function formatDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

async function countCompletedTaskLogsOnDate(userId, date) {
  return prisma.taskLog.count({
    where: { completedBy: userId, status: 'completed', loggedAt: getUTCRangeForBerlinDay(date), ...EXCLUDE_ONCE },
  })
}

async function countCompletedTaskLogs(userId, from, to) {
  return prisma.taskLog.count({
    where: { completedBy: userId, status: 'completed', forDate: { gte: from, lte: to }, ...EXCLUDE_ONCE },
  })
}

router.get('/stats', requireAuth, async (req, res) => {
  const curWeekStart = currentWeekStart()
  const curWeekEnd = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() + 6)
    return formatDateISO(d)
  })()

  const lastWeekStart = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() - 7)
    return formatDateISO(d)
  })()
  const lastWeekEnd = (() => {
    const d = new Date(curWeekStart)
    d.setDate(d.getDate() - 1)
    return formatDateISO(d)
  })()

  const curMonthStart = currentMonthStart()
  const curMonthEnd = (() => {
    const todayBerlin = new Date(dateStringInBerlin(0))
    const lastDay = new Date(todayBerlin.getFullYear(), todayBerlin.getMonth() + 1, 0).getDate()
    return `${todayBerlin.getFullYear()}-${String(todayBerlin.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })()

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

  const userStats = await Promise.all(users.map(async (userRecord) => ({
    id: userRecord.id,
    name: userRecord.name,
    curDay: await countCompletedTaskLogsOnDate(userRecord.id, today),
    curWeek: await countCompletedTaskLogs(userRecord.id, curWeekStart, curWeekEnd),
    lastWeek: await countCompletedTaskLogs(userRecord.id, lastWeekStart, lastWeekEnd),
    curMonth: await countCompletedTaskLogs(userRecord.id, curMonthStart, curMonthEnd),
    lastMonth: await countCompletedTaskLogs(userRecord.id, lastMonthStart, lastMonthEnd),
    dayTrophies: userRecord.dayTrophies,
    weekTrophies: userRecord.weekTrophies,
    monthTrophies: userRecord.monthTrophies,
  })))

  const result = userStats

  res.json(result)
})

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: [{ sortOrder: 'asc' }] })
  res.json(tasks.map(t => ({ ...t, weekdays: t.weekdays ? JSON.parse(t.weekdays) : null })))
})

router.get('/admin/export', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { isAutoGenerated: false },
    orderBy: [{ sortOrder: 'asc' }],
    select: { title: true, type: true, priority: true, weekdays: true, fixedWeekday: true, fixedDayOfMonth: true, dueDate: true, isActive: true },
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
  let count = 0

  for (const t of tasks) {
    if (validateTaskInput(t)) continue
    await prisma.task.create({
      data: {
        title: t.title.trim(),
        type: t.type,
        priority: t.priority || 'normal',
        weekdays: Array.isArray(t.weekdays) && t.weekdays.length ? JSON.stringify(t.weekdays) : null,
        fixedWeekday: Number.isInteger(t.fixedWeekday) ? t.fixedWeekday : null,
        fixedDayOfMonth: Number.isInteger(t.fixedDayOfMonth) ? t.fixedDayOfMonth : null,
        dueDate: t.type === 'once' && t.dueDate ? t.dueDate : null,
        isActive: t.isActive !== false,
        sortOrder: nextOrder++,
      },
    })
    count++
  }
  res.json({ message: `${count} Aufgaben importiert` })
})

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate })
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

  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate, isActive } = req.body
  const err = validateTaskInput({ title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, dueDate })
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
      dueDate: type === 'once' ? dueDate : null,
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
