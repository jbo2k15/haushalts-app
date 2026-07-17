import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

const ORIGINAL_LAT = process.env.WEATHER_LAT
const ORIGINAL_LON = process.env.WEATHER_LON

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

beforeEach(() => {
  process.env.WEATHER_LAT = '51.5'
  process.env.WEATHER_LON = '7.5'
})

afterEach(() => {
  process.env.WEATHER_LAT = ORIGINAL_LAT
  process.env.WEATHER_LON = ORIGINAL_LON
})

describe('GET /api/weather/status', () => {
  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/weather/status')
    expect(res.status).toBe(401)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/weather/status').set(authHeader(user.id))
    expect(res.status).toBe(403)
  })

  it('gibt den Wetter-Status für Admins zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).get('/api/weather/status').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('configured', true)
    expect(res.body).toHaveProperty('thresholdMM')
    expect(res.body).toHaveProperty('rainMM')
    expect(res.body).toHaveProperty('checkedAt')
  })

  it('meldet configured:false ohne WEATHER_LAT/WEATHER_LON', async () => {
    delete process.env.WEATHER_LAT
    delete process.env.WEATHER_LON
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).get('/api/weather/status').set(authHeader(admin.id))
    expect(res.body.configured).toBe(false)
  })
})
