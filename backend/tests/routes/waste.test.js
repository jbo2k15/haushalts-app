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

describe('GET /api/waste/status', () => {
  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/waste/status')
    expect(res.status).toBe(401)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/waste/status').set(authHeader(user.id))
    expect(res.status).toBe(403)
  })

  it('gibt eine leere Liste zurück, solange kein Sync gelaufen ist', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).get('/api/waste/status').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ checkedAt: null, unmatchedSummaries: [] })
  })

  it('gibt die zuletzt gespeicherten unerkannten Einträge zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    await prisma.wasteSyncStatus.create({
      data: { id: 'singleton', unmatchedSummaries: JSON.stringify(['Sperrmüll']), notifiedSummaries: JSON.stringify(['Sperrmüll']) },
    })
    const res = await request(app).get('/api/waste/status').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.unmatchedSummaries).toEqual(['Sperrmüll'])
    expect(res.body.checkedAt).toBeTruthy()
  })
})
