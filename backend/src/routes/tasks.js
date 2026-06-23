import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

const router = Router()

function todayString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function yesterdayString() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function twoDaysAgoString() {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = (day + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function currentMonthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

router.get('/', requireAuth, async (req, res) => {
  const today = todayString()
  const yesterday = yesterdayString()
  const twoDaysAgo = twoDaysAgoString()
  const todayWeekday = new Date().getDay()
  const todayDayOfMonth = new Date().getDate()
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
      const completionYesterday = await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: yesterday } },
      })
      const completionTwoDaysAgo = await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: twoDaysAgo } },
      })

      result.daily.push({
        ...task,
        weekdays: weekdays,
        completed: !!completionToday,
        completedBy: completionToday?.user?.name || null,
        overdueDay1: !completionYesterday,
        overdueDay2: !completionTwoDaysAgo,
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
    take: 200,
  })
  res.json(logs)
})

router.get('/stats', requireAuth, async (req, res) => {
  const monthStart = currentMonthStart()
  const users = await prisma.user.findMany({ where: { approved: true } })

  const stats = await Promise.all(
    users.map(async (user) => {
      const count = await prisma.taskLog.count({
        where: { completedBy: user.id, status: 'completed', forDate: { gte: monthStart } },
      })
      return { name: user.name, count }
    })
  )

  res.json(stats.sort((a, b) => b.count - a.count))
})

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  const tasks = await prisma.task.findMany({ orderBy: [{ sortOrder: 'asc' }] })
  res.json(tasks.map(t => ({ ...t, weekdays: t.weekdays ? JSON.parse(t.weekdays) : null })))
})

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  const { title, type, priority, weekdays, fixedWeekday, fixedDayOfMonth, isActive } = req.body
  if (!title || !type) return res.status(400).json({ error: 'Titel und Typ sind erforderlich' })

  const maxOrder = await prisma.task.aggregate({ _max: { sortOrder: true } })
  const task = await prisma.task.create({
    data: {
      title,
      type,
      priority: priority || 'normal',
      weekdays: weekdays ? JSON.stringify(weekdays) : null,
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
  const updated = await prisma.task.update({
    where: { id },
    data: {
      title,
      type,
      priority,
      weekdays: weekdays ? JSON.stringify(weekdays) : null,
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
  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.task.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } })
  }
  res.json({ message: 'Reihenfolge gespeichert' })
})

export default router
