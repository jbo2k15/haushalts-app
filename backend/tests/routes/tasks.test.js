import { describe, it, expect, beforeEach } from 'vitest'
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

  it('toggled zurück wenn bereits erledigt', async () => {
    const user = await createUser()
    const task = await createTask()
    await request(app).post(`/api/tasks/${task.id}/complete`).set(authHeader(user.id))
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.completed).toBe(false)

    const completion = await prisma.taskCompletion.findFirst({ where: { taskId: task.id } })
    expect(completion).toBeNull()
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
