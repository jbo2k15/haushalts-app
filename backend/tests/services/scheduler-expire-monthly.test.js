import { describe, it, expect, vi, afterEach } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import { expireMonthlyTasks } from '../../src/services/scheduler.js'

afterEach(() => vi.useRealTimers())

// Nachtlauf am 1. Dezember: abgelaufener Monat = November.
function mockFirstOfDecember() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-12-01T00:30:00Z'))
}

async function createTask(overrides = {}) {
  return prisma.task.create({
    data: { title: 'Filter tauschen', type: 'monthly', priority: 'normal', monthlyInterval: 2, ...overrides },
  })
}

async function createUser() {
  return prisma.user.create({ data: { email: `${Math.random()}@test.com`, passwordHash: 'x', name: 'Test', role: 'user', approved: true } })
}

const expiredLogs = taskId => prisma.taskLog.findMany({ where: { taskId, status: 'expired' } })
const stored = id => prisma.task.findUnique({ where: { id } })

describe('expireMonthlyTasks (Aufgaben mit Turnus)', () => {
  it('lässt eine im November fällige, nicht erledigte Aufgabe sofort verfallen und zählt im Turnus weiter', async () => {
    mockFirstOfDecember()
    const task = await createTask({ nextDueMonth: '2026-11' })

    await expireMonthlyTasks()

    const logs = await expiredLogs(task.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].forDate).toBe('2026-11-01')
    expect((await stored(task.id)).nextDueMonth).toBe('2027-01')
  })

  it('loggt nichts für eine im November erledigte Aufgabe', async () => {
    mockFirstOfDecember()
    const user = await createUser()
    const task = await createTask({ nextDueMonth: '2027-01' })
    await prisma.taskCompletion.create({ data: { taskId: task.id, completedBy: user.id, forDate: '2026-11-01' } })

    await expireMonthlyTasks()

    expect(await expiredLogs(task.id)).toHaveLength(0)
    expect((await stored(task.id)).nextDueMonth).toBe('2027-01')
  })

  it('verfällt eine über den ganzen November pausierte Aufgabe nicht, rückt aber den Termin vor', async () => {
    // Regression: vorher blieb nextDueMonth stehen und die Aufgabe war ab
    // dem Folgemonat dauerhaft unsichtbar.
    mockFirstOfDecember()
    const task = await createTask({ nextDueMonth: '2026-11' })
    await prisma.taskPause.create({ data: { taskId: task.id, pauseFrom: '2026-10-20', pauseTo: '2026-11-30' } })

    await expireMonthlyTasks()

    expect(await expiredLogs(task.id)).toHaveLength(0)
    expect((await stored(task.id)).nextDueMonth).toBe('2027-01')
  })

  it('zieht einen lange veralteten Termin im Turnus auf den nächsten Termin ab Dezember', async () => {
    mockFirstOfDecember()
    const task = await createTask({ nextDueMonth: '2026-06' }) // Turnus: Jun, Aug, Okt, Dez

    await expireMonthlyTasks()

    expect(await expiredLogs(task.id)).toHaveLength(0) // im November war sie laut Turnus nicht dran
    expect((await stored(task.id)).nextDueMonth).toBe('2026-12')
  })

  it('läuft nur am 1. des Monats', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-02T00:30:00Z'))
    const task = await createTask({ nextDueMonth: '2026-11' })

    await expireMonthlyTasks()

    expect(await expiredLogs(task.id)).toHaveLength(0)
    expect((await stored(task.id)).nextDueMonth).toBe('2026-11')
  })
})
