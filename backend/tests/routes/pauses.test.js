import { describe, it, expect } from 'vitest'
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
    data: { email: 'user@test.com', passwordHash, name: 'Test User', role: 'user', approved: true, ...overrides },
  })
}

function authHeader(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/pauses/global', () => {
  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/pauses/global')
    expect(res.status).toBe(401)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/pauses/global').set(authHeader(user.id))
    expect(res.status).toBe(403)
  })

  it('gibt null zurück, wenn keine globale Pause existiert', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).get('/api/pauses/global').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body).toBeNull()
  })
})

describe('PUT /api/pauses/global', () => {
  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/pauses/global').set(authHeader(user.id))
      .send({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })
    expect(res.status).toBe(403)
  })

  it('legt eine globale Pause an', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).put('/api/pauses/global').set(authHeader(admin.id))
      .send({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })
    expect(res.status).toBe(200)
    expect(res.body.pauseFrom).toBe('2026-08-01')
    expect(res.body.pauseTo).toBe('2026-08-10')

    const getRes = await request(app).get('/api/pauses/global').set(authHeader(admin.id))
    expect(getRes.body.pauseFrom).toBe('2026-08-01')
  })

  it('ersetzt eine bestehende globale Pause statt sie zu duplizieren', async () => {
    const admin = await createUser({ role: 'admin' })
    await request(app).put('/api/pauses/global').set(authHeader(admin.id))
      .send({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })
    await request(app).put('/api/pauses/global').set(authHeader(admin.id))
      .send({ pauseFrom: '2026-09-01', pauseTo: '2026-09-10' })

    const rows = await prisma.globalPause.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].pauseFrom).toBe('2026-09-01')
  })

  it('lehnt ungültigen Zeitraum ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).put('/api/pauses/global').set(authHeader(admin.id))
      .send({ pauseFrom: '2026-08-10', pauseTo: '2026-08-01' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/pauses/global', () => {
  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).delete('/api/pauses/global').set(authHeader(user.id))
    expect(res.status).toBe(403)
  })

  it('beendet eine bestehende globale Pause', async () => {
    const admin = await createUser({ role: 'admin' })
    await request(app).put('/api/pauses/global').set(authHeader(admin.id))
      .send({ pauseFrom: '2026-08-01', pauseTo: '2026-08-10' })

    const res = await request(app).delete('/api/pauses/global').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Pause beendet')

    const rows = await prisma.globalPause.findMany()
    expect(rows).toHaveLength(0)
  })
})
