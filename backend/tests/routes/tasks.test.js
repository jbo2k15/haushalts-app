import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'

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

  it('lehnt nicht-tägliche Aufgaben ab', async () => {
    const user = await createUser()
    const task = await createTask({ type: 'weekly' })
    const res = await request(app)
      .post(`/api/tasks/${task.id}/uncomplete-last`)
      .set(authHeader(user.id))
    expect(res.status).toBe(400)
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
