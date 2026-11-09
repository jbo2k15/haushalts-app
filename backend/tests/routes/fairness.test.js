import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { todayString, addDaysToDateString } from '../../src/lib/dates.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

afterEach(() => {
  delete process.env.FAIRNESS_ENABLED
  vi.useRealTimers()
})

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `fair-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: 'x',
      name: 'Test User',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

function authHeader(userId) {
  return { Authorization: `Bearer ${jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })}` }
}

async function createTask(overrides = {}) {
  return prisma.task.create({ data: { title: 'Bad putzen', type: 'weekly', priority: 'normal', isActive: true, ...overrides } })
}

describe('Sichtbarkeit der Fairness-Statistik', () => {
  it('liefert 403 ohne Freigabe und Daten mit Freigabe', async () => {
    const user = await createUser()
    expect((await request(app).get('/api/fairness').set(authHeader(user.id))).status).toBe(403)

    const allowed = await createUser({ showFairness: true })
    const res = await request(app).get('/api/fairness').set(authHeader(allowed.id))
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('persons')
    expect(res.body.weeks).toHaveLength(4)
  })

  it('/config meldet, ob die Karte angezeigt werden darf', async () => {
    const user = await createUser({ showFairness: true })
    const res = await request(app).get('/api/fairness/config').set(authHeader(user.id))
    expect(res.body).toEqual({ enabled: true, canView: true, countMode: 'count' })
  })

  it('FAIRNESS_ENABLED=false schaltet das Feature ab', async () => {
    process.env.FAIRNESS_ENABLED = 'false'
    const user = await createUser({ showFairness: true, role: 'admin' })
    expect((await request(app).get('/api/fairness').set(authHeader(user.id))).status).toBe(404)
    expect((await request(app).get('/api/fairness/admin/users').set(authHeader(user.id))).status).toBe(404)
    const cfg = await request(app).get('/api/fairness/config').set(authHeader(user.id))
    expect(cfg.body).toEqual({ enabled: false, canView: false, countMode: 'count' })
  })

  it('nur Admins schalten die Freigabe pro Nutzer', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    expect((await request(app).put(`/api/fairness/admin/users/${user.id}/visibility`).set(authHeader(user.id)).send({ showFairness: true })).status).toBe(403)

    const res = await request(app).put(`/api/fairness/admin/users/${user.id}/visibility`).set(authHeader(admin.id)).send({ showFairness: true })
    expect(res.status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: user.id } })).showFairness).toBe(true)
    expect((await request(app).put(`/api/fairness/admin/users/${user.id}/visibility`).set(authHeader(admin.id)).send({ showFairness: 'ja' })).status).toBe(400)
  })
})

describe('Aufwand und Punkte', () => {
  it('friert den Aufwand der Aufgabe beim Erledigen ein', async () => {
    const user = await createUser()
    const task = await createTask({ difficulty: 3 })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    const log = await prisma.taskLog.findFirst({ where: { status: 'completed' } })
    expect(log).toMatchObject({ weight: 3, weightFromTask: false })
  })

  it('Aufwand ändern aktualisiert nur Alt-Einträge', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask()
    const legacy = await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, taskType: 'weekly', status: 'completed', completedBy: admin.id, forDate: '2026-10-05', weight: 2, weightFromTask: true } })
    const fresh = await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, taskType: 'weekly', status: 'completed', completedBy: admin.id, forDate: '2026-11-02', weight: 2 } })

    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: task.title, type: 'weekly', priority: 'normal', isActive: true, difficulty: 3 })
    expect(res.status).toBe(200)
    expect(res.body.difficulty).toBe(3)
    expect((await prisma.taskLog.findUnique({ where: { id: legacy.id } })).weight).toBe(3)
    expect((await prisma.taskLog.findUnique({ where: { id: fresh.id } })).weight).toBe(2)
  })

  it('lässt den Aufwand unverändert, wenn er nicht mitgeschickt wird', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ difficulty: 1 })
    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: 'Neu', type: 'weekly', priority: 'normal', isActive: true })
    expect(res.body.difficulty).toBe(1)
  })

  it('lehnt einen ungültigen Aufwand ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'X', type: 'daily', difficulty: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Ungültiger Aufwand')
  })

  it('Export und Import enthalten den Aufwand', async () => {
    const admin = await createUser({ role: 'admin' })
    await createTask({ title: 'Fenster', difficulty: 3 })
    const exp = await request(app).get('/api/tasks/admin/export').set(authHeader(admin.id))
    expect(exp.body[0].difficulty).toBe(3)

    await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: 'Import leicht', type: 'daily', difficulty: 1 }, { title: 'Import ohne', type: 'daily' }])
    expect((await prisma.task.findFirst({ where: { title: 'Import leicht' } })).difficulty).toBe(1)
    expect((await prisma.task.findFirst({ where: { title: 'Import ohne' } })).difficulty).toBe(2)
  })

  it('rechnet die Punkte in der Statistik', async () => {
    // Altes Konto: Tage vor der Konto-Anlage zaehlen nicht als Anwesenheit.
    const user = await createUser({ showFairness: true, createdAt: new Date('2026-01-01T12:00:00Z') })
    const hard = await createTask({ title: 'Schwer', difficulty: 3 })
    const easy = await createTask({ title: 'Leicht', type: 'daily', difficulty: 1 })
    await request(app).post(`/api/tasks/${hard.id}/complete`).set(authHeader(user.id))
    await request(app).post(`/api/tasks/${easy.id}/complete`).set(authHeader(user.id))
    const res = await request(app).get('/api/fairness').set(authHeader(user.id))
    expect(res.body.totalPoints).toBe(4)
    expect(res.body.persons[0]).toMatchObject({ id: user.id, points: 4, count: 2, share: 100 })
  })
})

describe('Zählweise für Rangliste und Statistik', () => {
  async function weightedLog(user, weight, isoDate) {
    return prisma.taskLog.create({
      data: { taskTitle: 'X', taskType: 'daily', status: 'completed', completedBy: user.id, forDate: isoDate, loggedAt: new Date(`${isoDate}T10:00:00Z`), weight },
    })
  }

  it('nur Admins stellen die Zählweise um, ungültige Werte werden abgelehnt', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser()
    expect((await request(app).put('/api/fairness/admin/settings').set(authHeader(user.id)).send({ countMode: 'weighted' })).status).toBe(403)
    expect((await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'punkte' })).status).toBe(400)
    const res = await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'weighted' })
    expect(res.body).toEqual({ countMode: 'weighted' })
    expect((await request(app).get('/api/fairness/config').set(authHeader(user.id))).body.countMode).toBe('weighted')
  })

  it('Statistik zählt bei gewichteter Zählweise Punkte', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ type: 'daily', difficulty: 3 })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(admin.id))

    let stats = await request(app).get('/api/tasks/stats').set(authHeader(admin.id))
    expect(stats.body.find(u => u.id === admin.id).curDay).toBe(1)

    await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'weighted' })
    stats = await request(app).get('/api/tasks/stats').set(authHeader(admin.id))
    expect(stats.body.find(u => u.id === admin.id).curDay).toBe(3)

    process.env.FAIRNESS_ENABLED = 'false'
    stats = await request(app).get('/api/tasks/stats').set(authHeader(admin.id))
    expect(stats.body.find(u => u.id === admin.id).curDay).toBe(1)
  })

  it('Umstellen berechnet die Pokale neu und lässt sich zurückdrehen', async () => {
    const admin = await createUser({ role: 'admin' })
    const viel = await createUser({ name: 'Viel leicht' })
    // Vorgestern (abgeschlossener Tag): 3 leichte Erledigungen gegen 2 aufwaendige
    const day = addDaysToDateString(todayString(), -2)
    for (let i = 0; i < 3; i++) await weightedLog(viel, 1, day)
    for (let i = 0; i < 2; i++) await weightedLog(admin, 3, day)

    await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'count' })
    expect((await prisma.user.findUnique({ where: { id: viel.id } })).dayTrophies).toBe(1)
    expect((await prisma.user.findUnique({ where: { id: admin.id } })).dayTrophies).toBe(0)

    await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'weighted' })
    expect((await prisma.user.findUnique({ where: { id: viel.id } })).dayTrophies).toBe(0)
    expect((await prisma.user.findUnique({ where: { id: admin.id } })).dayTrophies).toBe(1)

    await request(app).put('/api/fairness/admin/settings').set(authHeader(admin.id)).send({ countMode: 'count' })
    expect((await prisma.user.findUnique({ where: { id: viel.id } })).dayTrophies).toBe(1)
  })
})

describe('Urlaubszeiten', () => {
  it('Urlaubsmodus schreibt eine Urlaubszeit ab morgen', async () => {
    const user = await createUser()
    await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: true })
    const periods = await prisma.vacationPeriod.findMany({ where: { userId: user.id } })
    expect(periods).toHaveLength(1)
    expect(periods[0]).toMatchObject({ startDate: addDaysToDateString(todayString(), 1), endDate: null, source: 'toggle' })

    // Gleich wieder aus: kein voller Urlaubstag -> Zeitraum faellt weg
    await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: false })
    expect(await prisma.vacationPeriod.count({ where: { userId: user.id } })).toBe(0)
  })

  it('Ausschalten nach einigen Tagen beendet die Urlaubszeit am Vortag', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
    const user = await createUser()
    await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: true })
    vi.setSystemTime(new Date('2026-11-08T10:00:00Z'))
    await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: false })
    const [period] = await prisma.vacationPeriod.findMany({ where: { userId: user.id } })
    expect(period).toMatchObject({ startDate: '2026-11-02', endDate: '2026-11-07' })
  })

  it('gleicher Wert erneut schreibt keine zweite Urlaubszeit', async () => {
    const user = await createUser({ vacationMode: true })
    await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: true })
    expect(await prisma.vacationPeriod.count()).toBe(0)
  })

  it('Admins tragen Urlaubszeiten nach, bearbeiten und löschen sie', async () => {
    const admin = await createUser({ role: 'admin' })
    const user = await createUser({ name: 'Person B' })

    const created = await request(app).post('/api/fairness/admin/vacations').set(authHeader(admin.id))
      .send({ userId: user.id, startDate: '2026-10-20', endDate: '2026-10-25' })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ startDate: '2026-10-20', endDate: '2026-10-25', source: 'manual', days: 6 })

    const overlap = await request(app).post('/api/fairness/admin/vacations').set(authHeader(admin.id))
      .send({ userId: user.id, startDate: '2026-10-25', endDate: '2026-10-28' })
    expect(overlap.status).toBe(400)

    const reversed = await request(app).post('/api/fairness/admin/vacations').set(authHeader(admin.id))
      .send({ userId: user.id, startDate: '2026-10-28', endDate: '2026-10-26' })
    expect(reversed.status).toBe(400)

    const noEnd = await request(app).post('/api/fairness/admin/vacations').set(authHeader(admin.id))
      .send({ userId: user.id, startDate: '2026-12-24' })
    expect(noEnd.status).toBe(400)

    const updated = await request(app).put(`/api/fairness/admin/vacations/${created.body.id}`).set(authHeader(admin.id))
      .send({ startDate: '2026-10-19', endDate: '2026-10-25' })
    expect(updated.body.days).toBe(7)

    const list = await request(app).get('/api/fairness/admin/users').set(authHeader(admin.id))
    const b = list.body.find(u => u.id === user.id)
    expect(b.vacations).toHaveLength(1)
    expect(b.showFairness).toBe(false)

    const del = await request(app).delete(`/api/fairness/admin/vacations/${created.body.id}`).set(authHeader(admin.id))
    expect(del.status).toBe(200)
    expect(await prisma.vacationPeriod.count()).toBe(0)
  })

  it('Nicht-Admins dürfen keine Urlaubszeiten verwalten', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/fairness/admin/vacations').set(authHeader(user.id))
      .send({ userId: user.id, startDate: '2026-10-20', endDate: '2026-10-25' })
    expect(res.status).toBe(403)
  })

  it('Urlaubszeiten werden beim Löschen des Nutzers mitgelöscht', async () => {
    const user = await createUser()
    await prisma.vacationPeriod.create({ data: { userId: user.id, startDate: '2026-10-01', endDate: '2026-10-03' } })
    await prisma.user.delete({ where: { id: user.id } })
    expect(await prisma.vacationPeriod.count()).toBe(0)
  })
})
