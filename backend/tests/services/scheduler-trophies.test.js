import { describe, it, expect, vi, afterEach } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import { updateTrophyCache, pruneOldTaskLogs } from '../../src/services/scheduler.js'
import { calculateTrophies } from '../../src/lib/trophies.js'
import { addDaysToDateString, todayString, currentWeekStart, currentMonthStart } from '../../src/lib/dates.js'

afterEach(() => vi.useRealTimers())

function mockToday(isoString) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoString))
}

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: 'x',
      name: 'Test User',
      approved: true,
      ...overrides,
    },
  })
}

// taskId bewusst weggelassen (null) - deckt sich mit EXCLUDE_ONCE's
// "taskId: null"-Zweig (zaehlt als nicht-once, also trophy-relevant), ohne
// eine echte Task/TaskCompletion-Kette aufbauen zu muessen.
async function completedLog(user, isoDate) {
  return prisma.taskLog.create({
    data: {
      taskTitle: 'Testaufgabe',
      status: 'completed',
      completedBy: user.id,
      forDate: isoDate,
      loggedAt: new Date(`${isoDate}T10:00:00Z`),
    },
  })
}

describe('updateTrophyCache', () => {
  it('addiert die Baseline zu den frisch berechneten Trophäen aus den retained Logs', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const user = await createUser({ dayTrophiesBaseline: 5, weekTrophiesBaseline: 2, monthTrophiesBaseline: 1 })
    await completedLog(user, '2026-07-09') // gestern -> alleiniger Sieger des Tages

    await updateTrophyCache()

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.dayTrophies).toBe(6) // 5 Baseline + 1 frisch
    expect(updated.weekTrophies).toBe(2) // keine neue Wochen-Trophäe
    expect(updated.monthTrophies).toBe(1)
  })
})

describe('pruneOldTaskLogs', () => {
  it('ist ein No-Op, wenn keine Logs älter als die Aufbewahrungsfrist existieren', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const user = await createUser()
    await completedLog(user, '2026-07-01') // weit innerhalb der 2-Jahres-Frist

    await pruneOldTaskLogs()

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.dayTrophiesBaseline).toBe(0)
    expect(await prisma.taskLog.count()).toBe(1)
  })

  it('lässt Logs innerhalb der Aufbewahrungsfrist unangetastet (Grenzfall: genau am Cutoff-Tag)', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const user = await createUser()
    const cutoffDate = addDaysToDateString(todayString(), -730)
    await completedLog(user, cutoffDate) // genau am Cutoff-Tag, nicht "davor" -> bleibt

    await pruneOldTaskLogs()

    expect(await prisma.taskLog.count()).toBe(1)
    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.dayTrophiesBaseline).toBe(0)
  })

  it('bankt die Trophäe eines Tages vor dem Cutoff in die Baseline und löscht die zugehörigen Logs', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const [u1, u2] = await Promise.all([createUser(), createUser()])
    const oldDate = addDaysToDateString(todayString(), -800) // sicher älter als 730 Tage
    await completedLog(u1, oldDate)
    await completedLog(u1, oldDate)
    await completedLog(u2, oldDate)

    await pruneOldTaskLogs()

    expect(await prisma.taskLog.count()).toBe(0) // alte Logs geloescht

    const [updated1, updated2] = await Promise.all([
      prisma.user.findUnique({ where: { id: u1.id } }),
      prisma.user.findUnique({ where: { id: u2.id } }),
    ])
    expect(updated1.dayTrophiesBaseline).toBe(1) // u1 hatte mehr Erledigungen -> gewinnt den Tag
    expect(updated2.dayTrophiesBaseline).toBe(0)
  })

  it('summiert die Baseline über mehrere Läufe auf (increment, kein Überschreiben)', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const user = await createUser({ dayTrophiesBaseline: 3 })
    const oldDate = addDaysToDateString(todayString(), -800)
    await completedLog(user, oldDate) // alleiniger Sieger

    await pruneOldTaskLogs()

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.dayTrophiesBaseline).toBe(4) // 3 vorher + 1 neu, nicht überschrieben
  })

  it('Invariante: Gesamt-Trophäen (Baseline + retained) bleiben nach Prune identisch zur Volltext-Berechnung', async () => {
    mockToday('2026-07-10T10:00:00Z')
    const [u1, u2] = await Promise.all([createUser(), createUser()])
    const oldDate = addDaysToDateString(todayString(), -800) // wird geprunt
    const recentDate = '2026-07-05' // bleibt erhalten

    // Alter Zeitraum: u1 gewinnt den Tag (2 vs 1)
    await completedLog(u1, oldDate)
    await completedLog(u1, oldDate)
    await completedLog(u2, oldDate)
    // Junger Zeitraum: u2 gewinnt den Tag (2 vs 1)
    await completedLog(u2, recentDate)
    await completedLog(u2, recentDate)
    await completedLog(u1, recentDate)

    // Referenz: was calculateTrophies über die GESAMTE (ungeprunte) Historie liefern würde.
    const allLogs = await prisma.taskLog.findMany({ select: { completedBy: true, loggedAt: true } })
    const users = [u1, u2]
    const today = todayString()
    const reference = calculateTrophies(allLogs, users, {
      today, curWeekStart: currentWeekStart(), curMonthStart: currentMonthStart(),
    })

    await pruneOldTaskLogs()
    await updateTrophyCache()

    const [updated1, updated2] = await Promise.all([
      prisma.user.findUnique({ where: { id: u1.id } }),
      prisma.user.findUnique({ where: { id: u2.id } }),
    ])
    expect(updated1.dayTrophies).toBe(reference.dayTrophies[u1.id])
    expect(updated2.dayTrophies).toBe(reference.dayTrophies[u2.id])
  })
})
