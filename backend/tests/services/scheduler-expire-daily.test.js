import { describe, it, expect, vi, afterEach } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import { expireDailyTasks } from '../../src/services/scheduler.js'

afterEach(() => vi.useRealTimers())

// 2026-07-15 ist ein Mittwoch -> vor 2 Tagen (twoDaysAgo) ist Montag (2026-07-13).
function mockWednesday() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-15T10:00:00Z'))
}

async function createTask(overrides = {}) {
  return prisma.task.create({
    data: { title: 'Testaufgabe', type: 'daily', priority: 'normal', createdAt: new Date('2026-07-01T00:00:00Z'), ...overrides },
  })
}

async function expiredLog(taskId) {
  return prisma.taskLog.findFirst({ where: { taskId, forDate: '2026-07-13', status: 'expired' } })
}

describe('expireDailyTasks', () => {
  it('loggt eine unbeschränkte (jeden Tag fällige) Aufgabe NICHT als verfallen, auch wenn sie vor 2 Tagen nicht abgehakt wurde', async () => {
    // Regression: eine taeglich wiederholende Aufgabe ist am naechsten Tag
    // ohnehin neu faellig - kein Ueberfaellig/Verfallen-Konzept fuer sie.
    mockWednesday()
    const task = await createTask() // keine weekdays -> unbeschraenkt

    await expireDailyTasks()

    expect(await expiredLog(task.id)).toBeNull()
  })

  it('loggt eine wochentagsbeschränkte Aufgabe als verfallen, wenn sie am fälligen Tag nicht erledigt wurde', async () => {
    mockWednesday()
    const task = await createTask({ weekdays: JSON.stringify([1]) }) // Montag

    await expireDailyTasks()

    expect(await expiredLog(task.id)).toBeTruthy()
  })

  it('loggt eine wochentagsbeschränkte Aufgabe NICHT als verfallen, wenn sie erledigt wurde', async () => {
    mockWednesday()
    const task = await createTask({ weekdays: JSON.stringify([1]) })
    await prisma.taskCompletion.create({ data: { taskId: task.id, forDate: '2026-07-13' } })

    await expireDailyTasks()

    expect(await expiredLog(task.id)).toBeNull()
  })

  it('loggt eine wochentagsbeschränkte, wetterabhängige Aufgabe NICHT als verfallen, wenn sie automatisch (system-completed) erledigt wurde', async () => {
    // Regression: system-completed hat bewusst KEINE TaskCompletion (siehe
    // getTaskOverview) - expireDailyTasks muss trotzdem erkennen, dass der
    // Tag erledigt war.
    mockWednesday()
    const task = await createTask({ weekdays: JSON.stringify([1]), weatherDependent: true })
    await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'system-completed', forDate: '2026-07-13' } })

    await expireDailyTasks()

    expect(await expiredLog(task.id)).toBeNull()
  })

  it('loggt eine unbeschränkte, wetterabhängige Aufgabe NICHT als verfallen (Task-2-Beispiel: Blumen gießen)', async () => {
    mockWednesday()
    const task = await createTask({ title: 'Blumen gießen', weatherDependent: true })
    await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'system-completed', forDate: '2026-07-13' } })

    await expireDailyTasks()

    expect(await expiredLog(task.id)).toBeNull()
  })
})
