import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import { sendPushToUser } from './push.js'
import { syncWasteCalendar } from './waste-calendar.js'

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

async function expireDailyTasks() {
  const twoDaysAgo = twoDaysAgoString()
  const twoDaysAgoDate = new Date()
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2)
  const twoDaysAgoWeekday = twoDaysAgoDate.getDay()

  const tasks = await prisma.task.findMany({ where: { type: 'daily', isActive: true } })

  for (const task of tasks) {
    // Aufgabe existierte an dem Tag noch nicht
    if (task.createdAt > twoDaysAgoDate) continue

    // Aufgabe war an dem Wochentag nicht fällig
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null
    if (weekdays && weekdays.length > 0 && !weekdays.includes(twoDaysAgoWeekday)) continue

    const completion = await prisma.taskCompletion.findUnique({
      where: { taskId_forDate: { taskId: task.id, forDate: twoDaysAgo } },
    })
    if (!completion) {
      const existing = await prisma.taskLog.findFirst({
        where: { taskId: task.id, forDate: twoDaysAgo, status: 'expired' },
      })
      if (!existing) {
        await prisma.taskLog.create({
          data: { taskId: task.id, taskTitle: task.title, status: 'expired', forDate: twoDaysAgo },
        })
      }
    }
  }
}

async function expireWeeklyTasks() {
  const now = new Date()
  if (now.getDay() !== 1) return

  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - 7)
  const weekStart = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth() + 1).padStart(2, '0')}-${String(lastMonday.getDate()).padStart(2, '0')}`

  const tasks = await prisma.task.findMany({ where: { type: 'weekly', isActive: true } })
  for (const task of tasks) {
    const completion = await prisma.taskCompletion.findFirst({
      where: { taskId: task.id, forDate: { gte: weekStart } },
    })
    if (!completion) {
      await prisma.taskLog.create({
        data: { taskId: task.id, taskTitle: task.title, status: 'expired', forDate: weekStart },
      })
      await pruneLog()
    }
  }
}

async function expireMonthlyTasks() {
  const now = new Date()
  if (now.getDate() !== 1) return

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`

  const tasks = await prisma.task.findMany({ where: { type: 'monthly', isActive: true } })
  for (const task of tasks) {
    const completion = await prisma.taskCompletion.findFirst({
      where: { taskId: task.id, forDate: { gte: monthStr } },
    })
    if (!completion) {
      await prisma.taskLog.create({
        data: { taskId: task.id, taskTitle: task.title, status: 'expired', forDate: monthStr },
      })
      await pruneLog()
    }
  }
}

async function sendDailyReminders() {
  const globalSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const [hours, minutes] = (globalSettings?.dailyTime || '21:00').split(':')
  const now = new Date()
  if (now.getHours() !== Number(hours) || now.getMinutes() !== Number(minutes)) return

  const today = todayString()
  const todayWeekday = now.getDay()

  const users = await prisma.user.findMany({ where: { approved: true } })
  for (const user of users) {
    const tasks = await prisma.task.findMany({ where: { type: 'daily', isActive: true } })
    const openTasks = []
    for (const task of tasks) {
      const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null
      if (weekdays && !weekdays.includes(todayWeekday)) continue
      const completion = await prisma.taskCompletion.findUnique({
        where: { taskId_forDate: { taskId: task.id, forDate: today } },
      })
      if (!completion) openTasks.push(task)
    }
    if (openTasks.length > 0) {
      await sendPushToUser(user.id, {
        title: 'Haushalt',
        body: `Du hast heute noch ${openTasks.length} Aufgabe${openTasks.length === 1 ? '' : 'n'} nicht abgeschlossen.`,
      })
    }
  }
}

async function sendWeeklyReminders() {
  const globalSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const weeklyDay = globalSettings?.weeklyDay ?? 6
  const [hours, minutes] = (globalSettings?.weeklyTime || '09:00').split(':')
  const now = new Date()
  if (now.getDay() !== weeklyDay || now.getHours() !== Number(hours) || now.getMinutes() !== Number(minutes)) return

  const tasks = await prisma.task.findMany({ where: { type: 'weekly', isActive: true } })
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  const openCount = []
  for (const task of tasks) {
    const completion = await prisma.taskCompletion.findFirst({
      where: { taskId: task.id, forDate: { gte: weekStart } },
    })
    if (!completion) openCount.push(task)
  }

  if (openCount.length > 0) {
    const users = await prisma.user.findMany({ where: { approved: true } })
    for (const user of users) {
      await sendPushToUser(user.id, {
        title: 'Haushalt',
        body: `Du hast noch ${openCount.length} offene Aufgabe${openCount.length === 1 ? '' : 'n'} in dieser Woche.`,
      })
    }
  }
}

export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await sendDailyReminders()
      await sendWeeklyReminders()
    } catch (err) {
      console.error('[Scheduler] Fehler in Minuten-Job:', err)
    }
  }, { timezone: 'Europe/Berlin' })

  cron.schedule('0 0 * * *', async () => {
    try {
      await expireDailyTasks()
      await expireWeeklyTasks()
      await expireMonthlyTasks()
      await syncWasteCalendar()
    } catch (err) {
      console.error('[Scheduler] Fehler in Mitternachts-Job:', err)
    }
  }, { timezone: 'Europe/Berlin' })

  syncWasteCalendar().catch(err => console.error('[Scheduler] Fehler bei initialem Kalender-Sync:', err))
}
