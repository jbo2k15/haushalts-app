import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import prisma from '../../src/lib/prisma.js'

vi.mock('../../src/services/push.js', () => ({ sendPushToUser: vi.fn() }))
const { sendPushToUser } = await import('../../src/services/push.js')
const { sendDailyReminders, sendWeeklyReminders, sendMonthlyReminders } = await import('../../src/services/scheduler.js')

afterEach(() => {
  vi.useRealTimers()
  sendPushToUser.mockClear()
})

function mockNow(isoString) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(isoString))
}

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: { email: `${Math.random()}@test.com`, passwordHash, name: 'Test User', role: 'user', approved: true, ...overrides },
  })
}

async function createTask(overrides = {}) {
  return prisma.task.create({ data: { title: 'Aufgabe', type: 'daily', priority: 'normal', isActive: true, ...overrides } })
}

describe('sendDailyReminders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nennt die Titel, wenn 3 oder weniger Aufgaben offen sind', async () => {
    mockNow('2026-07-20T19:00:00Z') // 21:00 Uhr Berlin (Sommerzeit)
    await createUser()
    await createTask({ title: 'Blumen gießen' })
    await createTask({ title: 'Geschirrspüler ausräumen' })

    await sendDailyReminders()

    expect(sendPushToUser).toHaveBeenCalled()
    const body = sendPushToUser.mock.calls[0][1].body
    expect(body).toBe('Noch offen heute: Blumen gießen, Geschirrspüler ausräumen.')
  })

  it('nennt nur den Zähler, wenn mehr als 3 Aufgaben offen sind', async () => {
    mockNow('2026-07-20T19:00:00Z')
    await createUser()
    for (const title of ['A', 'B', 'C', 'D']) await createTask({ title })

    await sendDailyReminders()

    const body = sendPushToUser.mock.calls[0][1].body
    expect(body).toBe('Du hast noch 4 offene Aufgaben heute.')
  })

  it('schickt keine Benachrichtigung, wenn keine Aufgabe offen ist', async () => {
    mockNow('2026-07-20T19:00:00Z')
    await createUser()

    await sendDailyReminders()

    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe('sendWeeklyReminders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nennt die Titel, wenn 3 oder weniger wöchentliche Aufgaben offen sind', async () => {
    mockNow('2026-07-18T07:00:00Z') // Samstag 09:00 Uhr Berlin (Default weeklyDay=6)
    await createUser()
    await createTask({ title: 'Bad putzen', type: 'weekly' })

    await sendWeeklyReminders()

    const body = sendPushToUser.mock.calls[0][1].body
    expect(body).toBe('Noch offen in dieser Woche: Bad putzen.')
  })
})

describe('sendMonthlyReminders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('nennt die Titel, wenn 3 oder weniger monatliche Aufgaben offen sind (Default: 1. des Monats, 09:00)', async () => {
    mockNow('2026-08-01T07:00:00Z') // 1. August, 09:00 Uhr Berlin
    await createUser()
    await createTask({ title: 'Rauchmelder prüfen', type: 'monthly' })

    await sendMonthlyReminders()

    expect(sendPushToUser).toHaveBeenCalled()
    const body = sendPushToUser.mock.calls[0][1].body
    expect(body).toBe('Noch offen in diesem Monat: Rauchmelder prüfen.')
  })

  it('löst nicht an einem anderen Tag im Monat aus', async () => {
    mockNow('2026-08-15T07:00:00Z')
    await createUser()
    await createTask({ title: 'Rauchmelder prüfen', type: 'monthly' })

    await sendMonthlyReminders()

    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('respektiert eine konfigurierte abweichende Uhrzeit/Tag', async () => {
    await prisma.notificationSettings.create({ data: { monthlyDay: 15, monthlyTime: '18:00' } })
    mockNow('2026-08-15T16:00:00Z') // 18:00 Uhr Berlin
    await createUser()
    await createTask({ title: 'Miete überweisen', type: 'monthly' })

    await sendMonthlyReminders()

    expect(sendPushToUser).toHaveBeenCalled()
  })

  it('berücksichtigt pausierte monatliche Aufgaben nicht in der Zählung', async () => {
    mockNow('2026-08-01T07:00:00Z')
    await createUser()
    const paused = await createTask({ title: 'Pausierte Aufgabe', type: 'monthly' })
    await prisma.taskPause.create({ data: { taskId: paused.id, pauseFrom: '2026-08-01', pauseTo: '2026-08-31' } })

    await sendMonthlyReminders()

    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
