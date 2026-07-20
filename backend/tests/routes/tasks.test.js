import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { todayString } from '../../src/lib/dates.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: 'user@test.com',
      passwordHash,
      name: 'Test User',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

function authHeader(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
  return { Authorization: `Bearer ${token}` }
}

async function createTask(overrides = {}) {
  return prisma.task.create({
    data: {
      title: 'Testaufgabe',
      type: 'daily',
      priority: 'normal',
      isActive: true,
      ...overrides,
    },
  })
}

describe('GET /api/tasks', () => {
  it('gibt Aufgaben zurück für authentifizierten Nutzer', async () => {
    const user = await createUser()
    await createTask()
    const res = await request(app).get('/api/tasks').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('daily')
    expect(res.body).toHaveProperty('once')
    expect(res.body).toHaveProperty('weekly')
    expect(res.body).toHaveProperty('monthly')
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(401)
  })

  describe('überfällige wochentagsbeschränkte Tagesaufgaben (Carryover)', () => {
    // 2026-07-15 ist ein Mittwoch (gestern = Di 2026-07-14, vorgestern = Mo 2026-07-13)
    afterEach(() => { vi.useRealTimers() })

    async function setupWednesday() {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-15T10:00:00Z'))
      return createUser()
    }

    it('zeigt eine Dienstags-Aufgabe am Mittwoch noch als überfällig', async () => {
      const user = await setupWednesday()
      const task = await createTask({ title: 'Schwimmtasche packen', weekdays: JSON.stringify([2]), createdAt: new Date('2026-07-01T00:00:00Z') })
      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeTruthy()
      expect(row.isOverdue).toBe(true)
      expect(row.completed).toBe(false)
    })

    it('zeigt eine Aufgabe an ihrem regulären Tag normal (nicht überfällig)', async () => {
      const user = await setupWednesday()
      const task = await createTask({ weekdays: JSON.stringify([3]), createdAt: new Date('2026-07-01T00:00:00Z') }) // Mittwoch
      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeTruthy()
      expect(row.isOverdue).toBe(false)
    })

    it('blendet eine Aufgabe aus, die weder heute fällig noch überfällig ist', async () => {
      const user = await setupWednesday()
      const task = await createTask({ weekdays: JSON.stringify([5]), createdAt: new Date('2026-07-01T00:00:00Z') }) // Freitag
      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      expect(res.body.daily.find(t => t.id === task.id)).toBeFalsy()
    })

    it('klärt die Überfälligkeit, sobald am Folgetag erledigt wird', async () => {
      const user = await setupWednesday()
      const task = await createTask({ weekdays: JSON.stringify([2]), createdAt: new Date('2026-07-01T00:00:00Z') }) // Dienstag
      await prisma.taskCompletion.create({ data: { taskId: task.id, completedBy: user.id, forDate: '2026-07-15' } })
      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeTruthy()
      expect(row.completed).toBe(true)
      expect(row.isOverdue).toBe(false)
    })

    it('blendet eine am Fälligkeitstag abgelehnte Dienstags-Aufgabe am Mittwoch aus, statt sie überfällig zu zeigen', async () => {
      const user = await setupWednesday()
      const task = await createTask({ title: 'Schwimmtasche packen', weekdays: JSON.stringify([2]), createdAt: new Date('2026-07-01T00:00:00Z') })
      await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'skipped', forDate: '2026-07-14' } }) // Dienstag abgelehnt
      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeFalsy()
    })
  })

  describe('wetterabhängige Aufgaben (vom System erledigt)', () => {
    it('zeigt eine wetterabhängige Aufgabe als erledigt mit systemCompleted, wenn ein system-completed-Log für heute existiert', async () => {
      const user = await createUser()
      const task = await createTask({ weatherDependent: true })
      await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'system-completed', forDate: todayString() } })

      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeTruthy()
      expect(row.completed).toBe(true)
      expect(row.systemCompleted).toBe(true)
      expect(row.isOverdue).toBe(false)
    })

    it('zeigt eine wetterabhängige Aufgabe ohne system-completed-Log ganz normal als offen', async () => {
      const user = await createUser()
      const task = await createTask({ weatherDependent: true })

      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const row = res.body.daily.find(t => t.id === task.id)
      expect(row).toBeTruthy()
      expect(row.completed).toBe(false)
      expect(row.systemCompleted).toBeFalsy()
    })

    it('erstellt keine TaskCompletion für eine system-completed Aufgabe (fließt nicht in Statistik/Trophäen ein)', async () => {
      const user = await createUser()
      const task = await createTask({ weatherDependent: true })
      await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'system-completed', forDate: todayString() } })

      await request(app).get('/api/tasks').set(authHeader(user.id))

      const completion = await prisma.taskCompletion.findFirst({ where: { taskId: task.id } })
      expect(completion).toBeNull()
    })
  })

  it('zeigt eine wöchentliche Erledigung weiterhin als erledigt, wenn die Woche vor Monats-/2-Tage-Fenster beginnt', async () => {
    // Regression: rangeStart previously only considered monthStart and
    // twoDaysAgo, not weekStart. On a Thursday early in the month, the
    // week's Monday can fall before both — the completion existed in the
    // DB but was excluded from the batch query, so it read back as
    // "not completed" right after being created.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T10:00:00Z')) // Donnerstag, Woche beginnt 2026-06-29
    try {
      const user = await createUser()
      const task = await createTask({ type: 'weekly' })

      const completeRes = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
      expect(completeRes.body.completed).toBe(true)

      const res = await request(app).get('/api/tasks').set(authHeader(user.id))
      const weeklyTask = res.body.weekly.find(t => t.id === task.id)
      expect(weeklyTask.completed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('zeigt den Zähler für eine mehrfach erledigbare wöchentliche Aufgabe', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly', allowMultiple: true })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))

    const res = await request(app).get('/api/tasks').set(authHeader(user.id))
    const weeklyTask = res.body.weekly.find(t => t.id === task.id)
    expect(weeklyTask.completed).toBe(true)
    expect(weeklyTask.count).toBe(2)
  })

  it('zeigt count:1 für eine normale (nicht mehrfach erledigbare) erledigte wöchentliche Aufgabe', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly' })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))

    const res = await request(app).get('/api/tasks').set(authHeader(user.id))
    const weeklyTask = res.body.weekly.find(t => t.id === task.id)
    expect(weeklyTask.count).toBe(1)
  })
})

describe('POST /api/tasks/:id/complete', () => {
  it('markiert eine Aufgabe als erledigt', async () => {
    const user = await createUser()
    const task = await createTask()
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.completed).toBe(true)

    const completion = await prisma.taskCompletion.findFirst({ where: { taskId: task.id } })
    expect(completion).toBeTruthy()
  })

  it('toggled zurück wenn bereits erledigt (nicht-tägliche Aufgabe)', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly' })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.completed).toBe(false)

    const completion = await prisma.taskCompletion.findFirst({ where: { taskId: task.id } })
    expect(completion).toBeNull()
  })

  it('normale tägliche Aufgabe: zweiter Klick schaltet zurück auf offen (wie bisher)', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily' }) // allowMultiple defaults to false

    const res1 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res1.status).toBe(200)
    expect(res1.body).toEqual({ completed: true })

    const res2 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ completed: false })

    const completions = await prisma.taskCompletion.findMany({ where: { taskId: task.id } })
    expect(completions).toHaveLength(0)
  })

  it('mehrfach erledigbare tägliche Aufgabe: jeder Klick erhöht den Zähler statt umzuschalten', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily', allowMultiple: true })

    const res1 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res1.status).toBe(200)
    expect(res1.body).toEqual({ completed: true, count: 1 })

    const res2 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ completed: true, count: 2 })

    const res3 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res3.body).toEqual({ completed: true, count: 3 })

    const completions = await prisma.taskCompletion.findMany({ where: { taskId: task.id } })
    expect(completions).toHaveLength(3)

    const logs = await prisma.taskLog.findMany({ where: { taskId: task.id, status: 'completed' } })
    expect(logs).toHaveLength(3)
  })

  it('mehrfach erledigbare wöchentliche Aufgabe: jeder Klick erhöht den Zähler statt umzuschalten', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly', allowMultiple: true })

    const res1 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res1.status).toBe(200)
    expect(res1.body).toEqual({ completed: true, count: 1 })

    const res2 = await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    expect(res2.body).toEqual({ completed: true, count: 2 })

    const completions = await prisma.taskCompletion.findMany({ where: { taskId: task.id } })
    expect(completions).toHaveLength(2)
    // Alle Erledigungen einer Woche teilen sich dasselbe forDate (Wochenbeginn).
    expect(new Set(completions.map(c => c.forDate)).size).toBe(1)
  })

  it('lehnt inaktive Aufgabe ab', async () => {
    const user = await createUser()
    const task = await createTask({ isActive: false })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('gibt 404 für unbekannte Aufgabe', async () => {
    const user = await createUser()
    const res = await request(app)
      .post('/api/tasks/nonexistent-id/complete')
      .set(authHeader(user.id))
    expect(res.status).toBe(404)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const task = await createTask()
    const res = await request(app).post(`/api/tasks/${task.id}/complete`)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/tasks/:id/skip', () => {
  it('überspringt eine tägliche Aufgabe', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily' })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/skip`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(true)
  })

  it('lehnt skip für nicht-tägliche Aufgabe ab', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly' })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/skip`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('nimmt einen Skip beim zweiten Aufruf wieder zurück (Toggle)', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily' })
    const first = await request(app).post(`/api/tasks/${task.id}/skip`).set(authHeader(user.id))
    expect(first.body.skipped).toBe(true)

    const second = await request(app).post(`/api/tasks/${task.id}/skip`).set(authHeader(user.id))
    expect(second.status).toBe(200)
    expect(second.body.skipped).toBe(false)

    const logs = await prisma.taskLog.findMany({ where: { taskId: task.id, status: 'skipped' } })
    expect(logs).toHaveLength(0)
  })

  it('lehnt skip für inaktive Aufgabe ab', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily', isActive: false })
    const res = await request(app).post(`/api/tasks/${task.id}/skip`).set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('gibt 400 für unbekannte Aufgabe zurück', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/tasks/does-not-exist/skip').set(authHeader(user.id))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/tasks/log', () => {
  it('gibt Log-Einträge absteigend nach Zeit sortiert zurück', async () => {
    const user = await createUser()
    const task = await createTask()
    await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'completed', completedBy: user.id, userName: user.name, forDate: '2026-06-01' } })
    await prisma.taskLog.create({ data: { taskId: task.id, taskTitle: task.title, status: 'skipped', forDate: '2026-06-02' } })

    const res = await request(app).get('/api/tasks/log').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(new Date(res.body[0].loggedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body[1].loggedAt).getTime())
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/tasks/log')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/tasks/stats', () => {
  it('gibt Statistik nur für freigeschaltete Nutzer zurück', async () => {
    const user = await createUser({ dayTrophies: 2, weekTrophies: 1, monthTrophies: 0 })
    await createUser({ email: 'pending@test.com', approved: false })

    const res = await request(app).get('/api/tasks/stats').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ name: 'Test User', dayTrophies: 2, weekTrophies: 1, monthTrophies: 0 })
    expect(res.body[0]).toHaveProperty('curDay')
    expect(res.body[0]).toHaveProperty('curWeek')
    expect(res.body[0]).toHaveProperty('curMonth')
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/tasks/stats')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/tasks/admin', () => {
  it('erstellt eine neue Aufgabe als Admin', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Neue Aufgabe', type: 'daily', priority: 'high' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Neue Aufgabe')
    expect(res.body.priority).toBe('high')
  })

  it('vergibt aufsteigende sortOrder-Werte', async () => {
    const admin = await createUser({ role: 'admin' })
    await createTask({ sortOrder: 5 })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Nächste Aufgabe', type: 'daily' })
    expect(res.body.sortOrder).toBe(6)
  })

  it('lehnt ungültige Eingaben ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: '', type: 'daily' })
    expect(res.status).toBe(400)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/tasks/admin').set(authHeader(user.id))
      .send({ title: 'Aufgabe', type: 'daily' })
    expect(res.status).toBe(403)
  })

  it('setzt weatherDependent für eine tägliche Aufgabe', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Blumen gießen', type: 'daily', weatherDependent: true })
    expect(res.status).toBe(200)
    expect(res.body.weatherDependent).toBe(true)
  })

  it('lehnt weatherDependent für eine wöchentliche Aufgabe ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Aufgabe', type: 'weekly', weatherDependent: true })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/tasks/admin/:id', () => {
  it('aktualisiert eine bestehende Aufgabe', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ title: 'Alt', priority: 'low' })
    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: 'Neu', type: 'daily', priority: 'high', isActive: true })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Neu')
    expect(res.body.priority).toBe('high')
  })

  it('lehnt Bearbeiten einer auto-generierten Aufgabe ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ isAutoGenerated: true })
    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: 'Neu', type: 'daily', priority: 'high', isActive: true })
    expect(res.status).toBe(403)
  })

  it('gibt 404 für unbekannte Aufgabe zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).put('/api/tasks/admin/does-not-exist').set(authHeader(admin.id))
      .send({ title: 'Neu', type: 'daily' })
    expect(res.status).toBe(404)
  })

  it('lehnt ungültige Eingaben ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask()
    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: 'Neu', type: 'nonsense' })
    expect(res.status).toBe(400)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const task = await createTask()
    const res = await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(user.id))
      .send({ title: 'Neu', type: 'daily' })
    expect(res.status).toBe(403)
  })
})

describe('POST /api/tasks/admin/import', () => {
  it('importiert gültige Aufgaben', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: 'Import A', type: 'daily' }, { title: 'Import B', type: 'weekly' }])
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('2 Aufgaben importiert')
    const tasks = await prisma.task.findMany({ where: { title: { in: ['Import A', 'Import B'] } } })
    expect(tasks).toHaveLength(2)
  })

  it('lehnt kaputtes Format ab (kein Array)', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send({ title: 'Kein Array' })
    expect(res.status).toBe(400)
  })

  it('lehnt ein leeres Array ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id)).send([])
    expect(res.status).toBe(400)
  })

  it('lehnt mehr als 200 Aufgaben ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ title: `Aufgabe ${i}`, type: 'daily' }))
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id)).send(tooMany)
    expect(res.status).toBe(400)
  })

  it('überspringt ungültige Einträge, importiert aber die gültigen', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: 'Gültig', type: 'daily' }, { title: '', type: 'daily' }, { title: 'Auch gültig', type: 'weekly' }])
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('2 Aufgaben importiert')
  })

  it('meldet 0 importierte Aufgaben, wenn alle Einträge ungültig sind', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: '', type: 'daily' }])
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('0 Aufgaben importiert')
  })

  it('erlaubt doppelte Titel (kein Uniqueness-Constraint)', async () => {
    const admin = await createUser({ role: 'admin' })
    await createTask({ title: 'Duplikat' })
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: 'Duplikat', type: 'daily' }])
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('1 Aufgaben importiert')
    const tasks = await prisma.task.findMany({ where: { title: 'Duplikat' } })
    expect(tasks).toHaveLength(2)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/tasks/admin/import').set(authHeader(user.id))
      .send([{ title: 'Aufgabe', type: 'daily' }])
    expect(res.status).toBe(403)
  })
})

describe('POST /api/tasks/:id/uncomplete-last', () => {
  it('entfernt die zeitlich letzte Erledigung samt Log-Eintrag', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily', allowMultiple: true })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))

    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ completed: true, count: 1 })

    const completions = await prisma.taskCompletion.findMany({ where: { taskId: task.id } })
    expect(completions).toHaveLength(1)
    const logs = await prisma.taskLog.findMany({ where: { taskId: task.id, status: 'completed' } })
    expect(logs).toHaveLength(1)
  })

  it('meldet completed:false wenn die letzte verbleibende Erledigung entfernt wird', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily', allowMultiple: true })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))

    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.body).toEqual({ completed: false, count: 0 })
  })

  it('lehnt ab, wenn nichts zum Zurücknehmen vorhanden ist', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily', allowMultiple: true })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('lehnt normale (nicht mehrfach erledigbare) tägliche Aufgaben ab', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'daily' }) // allowMultiple defaults to false
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('lehnt nicht mehrfach erledigbare wöchentliche Aufgaben ab', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly' }) // allowMultiple defaults to false
    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('lehnt monatliche und einmalige Aufgaben ab, auch mit allowMultiple:true im Payload', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'monthly' })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('entfernt die letzte Erledigung einer mehrfach erledigbaren wöchentlichen Aufgabe', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly', allowMultiple: true })
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))

    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ completed: true, count: 1 })
  })
})

describe('DELETE /api/users/:id (Admin-Schutz)', () => {
  it('verhindert Selbstlöschung', async () => {
    const admin = await createUser({ email: 'admin@test.com', role: 'admin' })
    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set(authHeader(admin.id))
    expect(res.status).toBe(400)
  })

  it('verhindert Löschen des letzten Admins', async () => {
    const admin = await createUser({ email: 'admin@test.com', role: 'admin' })
    const user = await createUser({ email: 'other@test.com', role: 'user' })
    const res = await request(app)
      .delete(`/api/users/${admin.id}`)
      .set(authHeader(user.id))
    // user ist kein Admin → 403
    expect(res.status).toBe(403)
  })

  it('lehnt nicht-Admin ab', async () => {
    const user = await createUser()
    const res = await request(app)
      .delete(`/api/users/any-id`)
      .set(authHeader(user.id))
    expect(res.status).toBe(403)
  })
})

describe('Pausenzeitraum pro Aufgabe', () => {
  it('speichert einen Pausenzeitraum beim Erstellen und gibt ihn über GET /tasks/admin zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const createRes = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Brotdose füllen', type: 'daily', pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })
    expect(createRes.status).toBe(200)

    const listRes = await request(app).get('/api/tasks/admin').set(authHeader(admin.id))
    const row = listRes.body.find(t => t.id === createRes.body.id)
    expect(row.pauseFrom).toBe('2026-08-01')
    expect(row.pauseTo).toBe('2026-08-10')
  })

  it('aktualisiert einen bestehenden Pausenzeitraum beim Bearbeiten', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ type: 'daily' })
    await prisma.taskPause.create({ data: { taskId: task.id, pauseFrom: '2026-07-01', pauseTo: '2026-07-10' } })

    await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: task.title, type: 'daily', pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })

    const rows = await prisma.taskPause.findMany({ where: { taskId: task.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].pauseFrom).toBe('2026-08-01')
  })

  it('löscht den Pausenzeitraum, wenn beim Bearbeiten null übergeben wird', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ type: 'daily' })
    await prisma.taskPause.create({ data: { taskId: task.id, pauseFrom: '2026-07-01', pauseTo: '2026-07-10' } })

    await request(app).put(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
      .send({ title: task.title, type: 'daily', pauseFrom: null, pauseTo: null })

    const rows = await prisma.taskPause.findMany({ where: { taskId: task.id } })
    expect(rows).toHaveLength(0)
  })

  it('lehnt einen Pausenzeitraum für eine einmalige Aufgabe ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/tasks/admin').set(authHeader(admin.id))
      .send({ title: 'Einmalig', type: 'once', dueDate: '2026-08-01', pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })
    expect(res.status).toBe(400)
  })

  it('blendet eine pausierte Aufgabe aus der Tagesübersicht aus und zeigt die pauseSummary', async () => {
    const user = await createUser()
    const today = todayString()
    const task = await createTask({ type: 'daily', title: 'Pausiert' })
    await createTask({ type: 'daily', title: 'Normal' })
    await prisma.taskPause.create({ data: { taskId: task.id, pauseFrom: today, pauseTo: today } })

    const res = await request(app).get('/api/tasks').set(authHeader(user.id))
    expect(res.body.daily.find(t => t.id === task.id)).toBeFalsy()
    expect(res.body.daily.find(t => t.title === 'Normal')).toBeTruthy()
    expect(res.body.pauseSummary.daily).toEqual({ paused: 1, total: 2 })
  })

  it('exportiert und importiert Pausenzeiträume', async () => {
    const admin = await createUser({ role: 'admin' })
    const task = await createTask({ type: 'weekly', title: 'Export-Test' })
    await prisma.taskPause.create({ data: { taskId: task.id, pauseFrom: '2026-08-01', pauseTo: '2026-08-10' } })

    const exportRes = await request(app).get('/api/tasks/admin/export').set(authHeader(admin.id))
    const exported = exportRes.body.find(t => t.title === 'Export-Test')
    expect(exported.pauseFrom).toBe('2026-08-01')
    expect(exported.pauseTo).toBe('2026-08-10')
    expect(exported.id).toBeUndefined()

    const importRes = await request(app).post('/api/tasks/admin/import').set(authHeader(admin.id))
      .send([{ title: 'Import mit Pause', type: 'weekly', pauseFrom: '2026-09-01', pauseTo: '2026-09-10' }])
    expect(importRes.body.message).toBe('1 Aufgaben importiert')

    const imported = await prisma.task.findFirst({ where: { title: 'Import mit Pause' } })
    const pause = await prisma.taskPause.findFirst({ where: { taskId: imported.id } })
    expect(pause.pauseFrom).toBe('2026-09-01')
    expect(pause.pauseTo).toBe('2026-09-10')
  })
})

describe('DELETE /api/tasks/admin/:id (Abfallkalender-Aufgaben)', () => {
  it('lehnt Löschen einer aktiven Abfallkalender-Aufgabe ab', async () => {
    const admin = await createUser({ email: 'admin2@test.com', role: 'admin' })
    const task = await createTask({ type: 'once', dueDate: '2026-08-01', isAutoGenerated: true, isActive: true })
    const res = await request(app).delete(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
    expect(res.status).toBe(403)

    const stillThere = await prisma.task.findUnique({ where: { id: task.id } })
    expect(stillThere).toBeTruthy()
  })

  it('erlaubt Löschen einer abgelaufenen (inaktiven) Abfallkalender-Aufgabe', async () => {
    const admin = await createUser({ email: 'admin3@test.com', role: 'admin' })
    const task = await createTask({ type: 'once', dueDate: '2026-06-01', isAutoGenerated: true, isActive: false })
    const res = await request(app).delete(`/api/tasks/admin/${task.id}`).set(authHeader(admin.id))
    expect(res.status).toBe(200)

    const deleted = await prisma.task.findUnique({ where: { id: task.id } })
    expect(deleted).toBeNull()
  })
})
