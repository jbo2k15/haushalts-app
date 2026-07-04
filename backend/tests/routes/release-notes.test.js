import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { readFileSync } from 'fs'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: 'release-notes@test.com',
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

describe('GET /api/release-notes', () => {
  it('meldet seen:false für einen neuen Nutzer, wenn eine Notiz für die aktuelle Version existiert', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/release-notes').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.version).toBe(version)
    // note kann null sein, falls für die aktuelle Version (noch) keine Notiz hinterlegt ist
    if (res.body.note) expect(res.body.seen).toBe(false)
  })

  it('meldet seen:true, nachdem die Version als gesehen markiert wurde', async () => {
    const user = await createUser()
    await request(app).put('/api/release-notes/seen').set(authHeader(user.id)).send({ version })

    const res = await request(app).get('/api/release-notes').set(authHeader(user.id))
    expect(res.body.seen).toBe(true)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.lastSeenVersion).toBe(version)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/release-notes')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/release-notes/seen', () => {
  it('lehnt ungültige Version ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/release-notes/seen').set(authHeader(user.id)).send({ version: 123 })
    expect(res.status).toBe(400)
  })
})
