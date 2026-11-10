import { describe, it, expect } from 'vitest'
import prisma from '../../src/lib/prisma.js'
import { cleanupUnapprovedUsers } from '../../src/services/scheduler.js'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = n => new Date(Date.now() - n * DAY)

function createUser(email, overrides = {}) {
  return prisma.user.create({
    data: { email, passwordHash: 'x', name: email, role: 'user', approved: false, ...overrides },
  })
}

const remaining = async () => (await prisma.user.findMany({ orderBy: { email: 'asc' } })).map(u => u.email)

describe('cleanupUnapprovedUsers', () => {
  it('löscht nie freigeschaltete Registrierungen, die älter als 10 Tage sind', async () => {
    await createUser('alt@test.com', { createdAt: daysAgo(11) })
    await createUser('frisch@test.com', { createdAt: daysAgo(9) })
    expect(await cleanupUnapprovedUsers()).toBe(1)
    expect(await remaining()).toEqual(['frisch@test.com'])
  })

  it('lässt freigeschaltete Konten unabhängig vom Alter in Ruhe', async () => {
    await createUser('mitglied@test.com', { approved: true, createdAt: daysAgo(400) })
    expect(await cleanupUnapprovedUsers()).toBe(0)
    expect(await remaining()).toEqual(['mitglied@test.com'])
  })

  it('löscht kein vom Admin gesperrtes Konto, das schon einmal angemeldet war', async () => {
    await createUser('gesperrt@test.com', { createdAt: daysAgo(400), lastActiveAt: daysAgo(30) })
    expect(await cleanupUnapprovedUsers()).toBe(0)
    expect(await remaining()).toEqual(['gesperrt@test.com'])
  })

  it('löscht kein gesperrtes Konto, an dem Verlauf hängt', async () => {
    const user = await createUser('verlauf@test.com', { createdAt: daysAgo(400) })
    const task = await prisma.task.create({ data: { title: 'Müll', type: 'daily' } })
    await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: 'Müll', taskType: 'daily', forDate: '2026-01-01', status: 'completed', completedBy: user.id } })
    expect(await cleanupUnapprovedUsers()).toBe(0)
    expect(await remaining()).toEqual(['verlauf@test.com'])
  })

  it('löscht nie einen Admin', async () => {
    await createUser('admin@test.com', { role: 'admin', createdAt: daysAgo(400) })
    expect(await cleanupUnapprovedUsers()).toBe(0)
    expect(await remaining()).toEqual(['admin@test.com'])
  })
})
