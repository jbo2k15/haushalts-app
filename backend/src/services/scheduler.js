import cron from 'node-cron'
import prisma from '../lib/prisma.js'
import { sendPushToUser } from './push.js'
import { syncWasteCalendar } from './waste-calendar.js'
import { checkWeatherDependentTasks } from './weather.js'
import { todayString, twoDaysAgoString, currentWeekStart, currentMonthStart, dateToISO, dateStringInBerlin } from '../lib/dates.js'
import { calculateTrophies } from '../lib/trophies.js'
import {
  isPausedOnDay,
  isPeriodFullyPaused,
  weekEndFromStart,
  monthEndFromStart,
  getGlobalPause,
  getIndividualPausesForTasks,
} from '../domain/pauses.js'

async function cleanupExpiredTokens() {
  const now = new Date()
  const [rt, prt] = await Promise.all([
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ])
  if (rt.count > 0 || prt.count > 0) {
    console.log(`[Cleanup] ${rt.count} abgelaufene RefreshTokens, ${prt.count} PasswordResetTokens gelöscht`)
  }
}

// Pausenzeiträume sind reine Anzeige-Filterung, kein gespeicherter Zustand -
// eine abgelaufene Zeile hat also keine Auswirkung mehr, soll aber nicht
// unbegrenzt in der Verwaltung als "Pausiert"/"Pause geplant" aufgeführt
// bleiben. pauseTo < heute heißt "der Zeitraum ist vorbei" (ein bis heute
// laufender Zeitraum gilt noch als aktiv, siehe SortableTask.jsx).
export async function cleanupExpiredPauses() {
  const today = todayString()
  const [taskPauses, globalPauses] = await Promise.all([
    prisma.taskPause.deleteMany({ where: { pauseTo: { lt: today } } }),
    prisma.globalPause.deleteMany({ where: { pauseTo: { lt: today } } }),
  ])
  if (taskPauses.count > 0 || globalPauses.count > 0) {
    console.log(`[Cleanup] ${taskPauses.count} abgelaufene TaskPause(n), ${globalPauses.count} abgelaufene GlobalPause(n) gelöscht`)
  }
}

async function expireDailyTasks() {
  const twoDaysAgo = twoDaysAgoString()
  const twoDaysAgoDate = new Date()
  twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() - 2)
  const twoDaysAgoWeekday = twoDaysAgoDate.getDay()

  const tasks = await prisma.task.findMany({ where: { type: 'daily', isActive: true } })
  const dueTasks = tasks.filter(task => {
    if (task.createdAt > twoDaysAgoDate) return false
    const weekdays = task.weekdays ? JSON.parse(task.weekdays) : null
    return !weekdays || weekdays.length === 0 || weekdays.includes(twoDaysAgoWeekday)
  })
  if (dueTasks.length === 0) return

  const taskIds = dueTasks.map(t => t.id)
  const [completions, existingLogs, skippedLogs, globalPause, individualPauseMap] = await Promise.all([
    prisma.taskCompletion.findMany({ where: { taskId: { in: taskIds }, forDate: twoDaysAgo }, select: { taskId: true } }),
    prisma.taskLog.findMany({ where: { taskId: { in: taskIds }, forDate: twoDaysAgo, status: 'expired' }, select: { taskId: true } }),
    prisma.taskLog.findMany({ where: { taskId: { in: taskIds }, forDate: twoDaysAgo, status: 'skipped' }, select: { taskId: true } }),
    getGlobalPause(),
    getIndividualPausesForTasks(taskIds),
  ])
  const completedIds = new Set(completions.map(c => c.taskId))
  const loggedIds = new Set(existingLogs.map(l => l.taskId))
  const skippedIds = new Set(skippedLogs.map(l => l.taskId))

  await Promise.all(
    dueTasks
      .filter(t => !completedIds.has(t.id) && !loggedIds.has(t.id) && !skippedIds.has(t.id))
      .filter(t => !isPausedOnDay(individualPauseMap.get(t.id), globalPause, twoDaysAgo))
      .map(t => prisma.taskLog.create({ data: { taskId: t.id, taskTitle: t.title, status: 'expired', forDate: twoDaysAgo } }))
  )
}

async function expireWeeklyTasks() {
  const now = new Date()
  if (now.getDay() !== 1) return

  const lastMonday = new Date(now)
  lastMonday.setDate(now.getDate() - 7)
  const weekStart = dateToISO(lastMonday)

  const tasks = await prisma.task.findMany({ where: { type: 'weekly', isActive: true } })
  if (tasks.length === 0) return

  const completions = await prisma.taskCompletion.findMany({
    where: { taskId: { in: tasks.map(t => t.id) }, forDate: { gte: weekStart } },
    select: { taskId: true },
  })
  const completedIds = new Set(completions.map(c => c.taskId))
  const expiredCandidates = tasks.filter(t => !completedIds.has(t.id))
  if (expiredCandidates.length === 0) return

  const weekEnd = weekEndFromStart(weekStart)
  const [globalPause, individualPauseMap] = await Promise.all([
    getGlobalPause(),
    getIndividualPausesForTasks(expiredCandidates.map(t => t.id)),
  ])
  const expired = expiredCandidates.filter(t => !isPeriodFullyPaused(weekStart, weekEnd, [individualPauseMap.get(t.id), globalPause]))
  if (expired.length > 0) {
    await prisma.taskLog.createMany({
      data: expired.map(t => ({ taskId: t.id, taskTitle: t.title, status: 'expired', forDate: weekStart })),
    })
  }
}

async function expireMonthlyTasks() {
  const now = new Date()
  if (now.getDate() !== 1) return

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStr = dateToISO(lastMonth)

  const tasks = await prisma.task.findMany({ where: { type: 'monthly', isActive: true } })
  if (tasks.length === 0) return

  const completions = await prisma.taskCompletion.findMany({
    where: { taskId: { in: tasks.map(t => t.id) }, forDate: { gte: monthStr } },
    select: { taskId: true },
  })
  const completedIds = new Set(completions.map(c => c.taskId))
  const expiredCandidates = tasks.filter(t => !completedIds.has(t.id))
  if (expiredCandidates.length === 0) return

  const monthEnd = monthEndFromStart(monthStr)
  const [globalPause, individualPauseMap] = await Promise.all([
    getGlobalPause(),
    getIndividualPausesForTasks(expiredCandidates.map(t => t.id)),
  ])
  const expired = expiredCandidates.filter(t => !isPeriodFullyPaused(monthStr, monthEnd, [individualPauseMap.get(t.id), globalPause]))
  if (expired.length > 0) {
    await prisma.taskLog.createMany({
      data: expired.map(t => ({ taskId: t.id, taskTitle: t.title, status: 'expired', forDate: monthStr })),
    })
  }
}

async function expireOnce() {
  const today = todayString()
  const tasks = await prisma.task.findMany({ where: { type: 'once', isActive: true } })
  const tasksWithDue = tasks.filter(t => t.dueDate)
  if (tasksWithDue.length === 0) return

  const completions = await prisma.taskCompletion.findMany({
    where: { taskId: { in: tasksWithDue.map(t => t.id) } },
    select: { taskId: true, forDate: true },
  })
  const completedIds = new Set(completions.map(c => c.taskId))

  const toDeactivate = []
  const toLog = []

  for (const t of tasksWithDue) {
    const isPastOrToday = t.dueDate <= today
    if (!isPastOrToday) continue

    if (t.isAutoGenerated) {
      // Auto-generated (waste calendar): always deactivate and log as expired if not done
      toDeactivate.push(t.id)
      if (!completedIds.has(t.id)) {
        toLog.push({ taskId: t.id, taskTitle: t.title, status: 'expired', forDate: t.dueDate })
      }
    } else if (completedIds.has(t.id)) {
      // Regular once task: deactivate when completed (uncompleted stay visible as overdue)
      // Includes tasks due today so they disappear after completion at midnight
      toDeactivate.push(t.id)
    }
  }

  await Promise.all([
    ...toDeactivate.map(id => prisma.task.update({ where: { id }, data: { isActive: false } })),
    toLog.length > 0 ? prisma.taskLog.createMany({ data: toLog, skipDuplicates: true }) : null,
  ].filter(Boolean))
}

const WASTE_TASK_RETENTION_DAYS = 7

export async function cleanupOldWasteTasks() {
  const cutoff = dateStringInBerlin(-WASTE_TASK_RETENTION_DAYS)
  const result = await prisma.task.deleteMany({
    where: { isAutoGenerated: true, isActive: false, dueDate: { lt: cutoff } },
  })
  if (result.count > 0) {
    console.log(`[Cleanup] ${result.count} abgelaufene Abfallkalender-Aufgabe(n) älter als ${WASTE_TASK_RETENTION_DAYS} Tage gelöscht`)
  }
}

function berlinTime(now) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric', minute: 'numeric', weekday: 'short', day: 'numeric', hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { hour: Number(parts.hour), minute: Number(parts.minute), day: days[parts.weekday], dayOfMonth: Number(parts.day) }
}

// Bei wenigen offenen Aufgaben (<=3) die Titel nennen statt nur zu zählen -
// macht die Erinnerung handlungsleitender, ohne bei vielen offenen Aufgaben
// unhandlich zu werden (dann bleibt es beim reinen Zähler).
const NAMED_REMINDER_THRESHOLD = 3

function reminderBody(openTitles, periodSuffix) {
  const openCount = openTitles.length
  if (openCount <= NAMED_REMINDER_THRESHOLD) return `Noch offen ${periodSuffix}: ${openTitles.join(', ')}.`
  return `Du hast noch ${openCount} offene Aufgabe${openCount === 1 ? '' : 'n'} ${periodSuffix}.`
}

export async function sendDailyReminders() {
  const globalSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const [hours, minutes] = (globalSettings?.dailyTime || '21:00').split(':')
  const now = new Date()
  const berlin = berlinTime(now)
  if (berlin.hour !== Number(hours) || berlin.minute !== Number(minutes)) return

  const today = todayString()
  if (globalSettings?.lastDailyNotifiedDate === today) return

  const todayWeekday = now.getDay()
  const [tasks, users] = await Promise.all([
    prisma.task.findMany({ where: { type: 'daily', isActive: true } }),
    prisma.user.findMany({ where: { approved: true, vacationMode: false } }),
  ])

  const dueTodayTasks = tasks
    .filter(t => { const w = t.weekdays ? JSON.parse(t.weekdays) : null; return !w || !w.length || w.includes(todayWeekday) })

  const [completions, globalPause, individualPauseMap] = await Promise.all([
    prisma.taskCompletion.findMany({ where: { forDate: today, taskId: { in: dueTodayTasks.map(t => t.id) } }, select: { taskId: true } }),
    getGlobalPause(),
    getIndividualPausesForTasks(dueTodayTasks.map(t => t.id)),
  ])
  const completedIds = new Set(completions.map(c => c.taskId))

  const openTasks = dueTodayTasks
    .filter(t => !completedIds.has(t.id))
    .filter(t => !isPausedOnDay(individualPauseMap.get(t.id), globalPause, today))
  const openCount = openTasks.length
  console.log(`[Push] Täglich: ${openCount} offene Aufgaben, ${users.length} Nutzer, Zeit: ${berlin.hour}:${String(berlin.minute).padStart(2,'0')}`)

  if (openCount > 0) {
    const body = reminderBody(openTasks.map(t => t.title), 'heute')
    await Promise.all(users.map(user => sendPushToUser(user.id, { title: 'Haushalt', body })))
  }

  if (globalSettings) {
    await prisma.notificationSettings.update({ where: { id: globalSettings.id }, data: { lastDailyNotifiedDate: today } })
  } else {
    await prisma.notificationSettings.create({ data: { lastDailyNotifiedDate: today } })
  }
}

export async function sendWeeklyReminders() {
  const globalSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const weeklyDay = globalSettings?.weeklyDay ?? 6
  const [hours, minutes] = (globalSettings?.weeklyTime || '09:00').split(':')
  const now = new Date()
  const berlin = berlinTime(now)
  if (berlin.day !== weeklyDay || berlin.hour !== Number(hours) || berlin.minute !== Number(minutes)) return

  const weekStart = currentWeekStart()
  if (globalSettings?.lastWeeklyNotifiedDate === weekStart) return

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({ where: { type: 'weekly', isActive: true } }),
    prisma.user.findMany({ where: { approved: true, vacationMode: false } }),
  ])

  const [completions, globalPause, individualPauseMap] = await Promise.all([
    tasks.length === 0 ? [] : prisma.taskCompletion.findMany({
      where: { taskId: { in: tasks.map(t => t.id) }, forDate: { gte: weekStart } },
      select: { taskId: true },
    }),
    getGlobalPause(),
    getIndividualPausesForTasks(tasks.map(t => t.id)),
  ])
  const completedIds = new Set(completions.map(c => c.taskId))
  const today = todayString()
  const openTasks = tasks
    .filter(t => !completedIds.has(t.id))
    .filter(t => !isPausedOnDay(individualPauseMap.get(t.id), globalPause, today))
  const openCount = openTasks.length

  if (openCount > 0) {
    const body = reminderBody(openTasks.map(t => t.title), 'in dieser Woche')
    await Promise.all(users.map(user => sendPushToUser(user.id, { title: 'Haushalt', body })))
  }

  if (globalSettings) {
    await prisma.notificationSettings.update({ where: { id: globalSettings.id }, data: { lastWeeklyNotifiedDate: weekStart } })
  } else {
    await prisma.notificationSettings.create({ data: { lastWeeklyNotifiedDate: weekStart } })
  }
}

export async function sendMonthlyReminders() {
  const globalSettings = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const monthlyDay = globalSettings?.monthlyDay ?? 1
  const [hours, minutes] = (globalSettings?.monthlyTime || '09:00').split(':')
  const now = new Date()
  const berlin = berlinTime(now)
  if (berlin.dayOfMonth !== monthlyDay || berlin.hour !== Number(hours) || berlin.minute !== Number(minutes)) return

  const monthStart = currentMonthStart()
  if (globalSettings?.lastMonthlyNotifiedDate === monthStart) return

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({ where: { type: 'monthly', isActive: true } }),
    prisma.user.findMany({ where: { approved: true, vacationMode: false } }),
  ])

  const [completions, globalPause, individualPauseMap] = await Promise.all([
    tasks.length === 0 ? [] : prisma.taskCompletion.findMany({
      where: { taskId: { in: tasks.map(t => t.id) }, forDate: { gte: monthStart } },
      select: { taskId: true },
    }),
    getGlobalPause(),
    getIndividualPausesForTasks(tasks.map(t => t.id)),
  ])
  const completedIds = new Set(completions.map(c => c.taskId))
  const today = todayString()
  const openTasks = tasks
    .filter(t => !completedIds.has(t.id))
    .filter(t => !isPausedOnDay(individualPauseMap.get(t.id), globalPause, today))
  const openCount = openTasks.length

  if (openCount > 0) {
    const body = reminderBody(openTasks.map(t => t.title), 'in diesem Monat')
    await Promise.all(users.map(user => sendPushToUser(user.id, { title: 'Haushalt', body })))
  }

  if (globalSettings) {
    await prisma.notificationSettings.update({ where: { id: globalSettings.id }, data: { lastMonthlyNotifiedDate: monthStart } })
  } else {
    await prisma.notificationSettings.create({ data: { lastMonthlyNotifiedDate: monthStart } })
  }
}

async function updateTrophyCache() {
  const users = await prisma.user.findMany({ where: { approved: true } })
  const allLogs = await prisma.taskLog.findMany({
    where: {
      status: 'completed',
      completedBy: { not: null },
      OR: [{ taskId: null }, { task: { type: { not: 'once' } } }],
    },
    select: { completedBy: true, loggedAt: true },
  })

  const today = todayString()
  const curWeekStart = currentWeekStart()
  const curMonthStart = currentMonthStart()

  const { dayTrophies, weekTrophies, monthTrophies } = calculateTrophies(allLogs, users, { today, curWeekStart, curMonthStart })

  await Promise.all(users.map(user => prisma.user.update({
    where: { id: user.id },
    data: {
      dayTrophies: dayTrophies[user.id] || 0,
      weekTrophies: weekTrophies[user.id] || 0,
      monthTrophies: monthTrophies[user.id] || 0,
    },
  })))
}

export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await sendDailyReminders()
      await sendWeeklyReminders()
      await sendMonthlyReminders()
    } catch (err) {
      console.error('[Scheduler] Fehler in Minuten-Job:', err)
    }
  }, { timezone: 'Europe/Berlin' })

  cron.schedule('0 0 * * *', async () => {
    for (const [name, job] of [
      ['cleanupExpiredTokens', cleanupExpiredTokens],
      ['expireDailyTasks', expireDailyTasks],
      ['expireWeeklyTasks', expireWeeklyTasks],
      ['expireMonthlyTasks', expireMonthlyTasks],
      ['expireOnce', expireOnce],
      ['cleanupOldWasteTasks', cleanupOldWasteTasks],
      ['updateTrophyCache', updateTrophyCache],
      ['syncWasteCalendar', syncWasteCalendar],
      // Zuletzt: expireWeeklyTasks/expireMonthlyTasks oben brauchen die
      // Pausendaten noch für die Verfallen-Prüfung des gerade abgelaufenen
      // Zeitraums (z.B. eine Pause mit pauseTo = gestern kann genau die
      // letzte Woche/den letzten Monat vollständig abdecken) - erst danach
      // aufräumen, sonst würde dieselbe Pause im selben Lauf zu früh
      // gelöscht, bevor die Prüfung sie gesehen hat.
      ['cleanupExpiredPauses', cleanupExpiredPauses],
    ]) {
      try {
        await job()
      } catch (err) {
        console.error(`[Scheduler] Fehler in ${name}:`, err.message)
      }
    }
  }, { timezone: 'Europe/Berlin' })

  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkWeatherDependentTasks()
    } catch (err) {
      console.error('[Scheduler] Fehler bei checkWeatherDependentTasks:', err.message)
    }
  }, { timezone: 'Europe/Berlin' })

  syncWasteCalendar().catch(err => console.error('[Scheduler] Fehler bei initialem Kalender-Sync:', err))
  updateTrophyCache().catch(err => console.error('[Scheduler] Fehler bei initialem Trophy-Cache:', err))
  checkWeatherDependentTasks().catch(err => console.error('[Scheduler] Fehler beim initialen Wetter-Check:', err.message))
}
