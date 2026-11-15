import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { hashDisplayToken } from '../../src/middleware/display.js'

// Familien-Display, Etappe 3: Display-Schlüssel und Lesezugang.
const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

beforeAll(() => { process.env.DISPLAY_API_ENABLED = 'true' })
afterAll(() => { delete process.env.DISPLAY_API_ENABLED })

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `d-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: await bcrypt.hash('Test1234!x', 4),
      name: 'Nutzer',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

function authHeader(userId) {
  return { Authorization: `Bearer ${jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })}` }
}

async function createDisplayToken(admin, name = 'Wanddisplay') {
  const res = await request(app).post('/api/display/tokens').set(authHeader(admin.id)).send({ name })
  return res
}

const displayHeader = token => ({ Authorization: `Bearer ${token}` })

describe('Display-Schlüssel verwalten', () => {
  it('legt einen Schlüssel an und zeigt den Klartext nur beim Anlegen', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await createDisplayToken(admin)
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Wanddisplay')
    expect(res.body.token).toMatch(/^hd_[A-Za-z0-9_-]{40,}$/)

    const stored = await prisma.displayToken.findUnique({ where: { id: res.body.id } })
    expect(stored.tokenHash).toBe(hashDisplayToken(res.body.token))
    expect(stored.tokenHash).not.toContain(res.body.token)

    const list = await request(app).get('/api/display/tokens').set(authHeader(admin.id))
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0].token).toBeUndefined()
    expect(list.body[0].tokenHash).toBeUndefined()
  })

  it('lehnt fehlenden und zu langen Namen ab', async () => {
    const admin = await createUser({ role: 'admin' })
    expect((await createDisplayToken(admin, '   ')).status).toBe(400)
    expect((await createDisplayToken(admin, 'x'.repeat(61))).status).toBe(400)
    expect((await request(app).post('/api/display/tokens').set(authHeader(admin.id)).send({})).status).toBe(400)
  })

  it('begrenzt die Anzahl der Schlüssel', async () => {
    const admin = await createUser({ role: 'admin' })
    for (let i = 0; i < 10; i++) expect((await createDisplayToken(admin, `Display ${i}`)).status).toBe(201)
    expect((await createDisplayToken(admin, 'Zu viel')).status).toBe(400)
  })

  it('ein gelöschter Schlüssel verliert sofort den Zugriff', async () => {
    const admin = await createUser({ role: 'admin' })
    const created = (await createDisplayToken(admin)).body
    expect((await request(app).get('/api/display/overview').set(displayHeader(created.token))).status).toBe(200)

    const deleted = await request(app).delete(`/api/display/tokens/${created.id}`).set(authHeader(admin.id))
    expect(deleted.status).toBe(200)
    expect((await request(app).get('/api/display/overview').set(displayHeader(created.token))).status).toBe(401)
    expect((await request(app).delete(`/api/display/tokens/${created.id}`).set(authHeader(admin.id))).status).toBe(404)
  })

  it('Verwaltung ist Admins vorbehalten', async () => {
    const user = await createUser()
    expect((await request(app).get('/api/display/tokens').set(authHeader(user.id))).status).toBe(403)
    expect((await request(app).post('/api/display/tokens').set(authHeader(user.id)).send({ name: 'x' })).status).toBe(403)
    expect((await request(app).get('/api/display/status').set(authHeader(user.id))).status).toBe(403)
  })

  it('GET /status meldet den Hauptschalter', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).get('/api/display/status').set(authHeader(admin.id))
    expect(res.body).toEqual({ enabled: true })
  })
})

describe('Display-Zugang: Sicherheitsgrenze', () => {
  it('ohne Schlüssel, mit falschem Schlüssel und mit Nutzer-Token: 401', async () => {
    const admin = await createUser({ role: 'admin' })
    await createDisplayToken(admin)
    expect((await request(app).get('/api/display/overview')).status).toBe(401)
    expect((await request(app).get('/api/display/overview').set(displayHeader('hd_falsch'))).status).toBe(401)
    expect((await request(app).get('/api/display/overview').set(displayHeader('x'.repeat(300)))).status).toBe(401)
    // Ein Admin-Token ist kein Display-Schlüssel.
    expect((await request(app).get('/api/display/overview').set(authHeader(admin.id))).status).toBe(401)
  })

  it('ein Display-Schlüssel öffnet keine andere Route der App', async () => {
    const admin = await createUser({ role: 'admin' })
    const { token } = (await createDisplayToken(admin)).body
    for (const [method, path] of [
      ['get', '/api/tasks'],
      ['get', '/api/tasks/stats'],
      ['get', '/api/users'],
      ['get', '/api/storage/locations'],
      ['get', '/api/display/tokens'],
      ['post', '/api/display/tokens'],
      ['get', '/api/auth/me'],
      ['get', '/api/events/ticket'],
    ]) {
      const res = await request(app)[method](path).set(displayHeader(token)).send(method === 'get' ? undefined : { name: 'x' })
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401)
    }
  })

  it('ohne Hauptschalter antwortet der Display-Zugang mit 404, auch mit gültigem Schlüssel', async () => {
    const admin = await createUser({ role: 'admin' })
    const { token } = (await createDisplayToken(admin)).body
    process.env.DISPLAY_API_ENABLED = 'false'
    try {
      expect((await request(app).get('/api/display/overview').set(displayHeader(token))).status).toBe(404)
      const status = await request(app).get('/api/display/status').set(authHeader(admin.id))
      expect(status.body).toEqual({ enabled: false })
    } finally {
      process.env.DISPLAY_API_ENABLED = 'true'
    }
  })

  it('merkt sich die letzte Benutzung', async () => {
    const admin = await createUser({ role: 'admin' })
    const created = (await createDisplayToken(admin)).body
    await request(app).get('/api/display/overview').set(displayHeader(created.token))
    // lastUsedAt wird bewusst nicht abgewartet (fire-and-forget) - kurz pollen.
    let stored
    for (let i = 0; i < 20; i++) {
      stored = await prisma.displayToken.findUnique({ where: { id: created.id } })
      if (stored.lastUsedAt) break
      await new Promise(r => setTimeout(r, 25))
    }
    expect(stored.lastUsedAt).toBeInstanceOf(Date)
  })
})

describe('GET /api/display/overview', () => {
  it('liefert Aufgaben, Personen und knappen Vorrat in einer Antwort', async () => {
    const admin = await createUser({ role: 'admin', name: 'Tobias', color: '#2F6FDE' })
    const profile = (await request(app).post('/api/users/profiles').set(authHeader(admin.id)).send({ name: 'Erik', color: '#128A75' })).body
    const { token } = (await createDisplayToken(admin)).body

    await prisma.task.create({ data: { title: 'Betten machen', type: 'daily', timeOfDay: 'morning', difficulty: 1 } })
    await prisma.task.create({ data: { title: 'Bad putzen', type: 'weekly', difficulty: 3 } })
    await prisma.task.create({ data: { title: 'Inaktiv', type: 'daily', isActive: false } })
    const location = await prisma.storageLocation.create({ data: { name: 'Keller' } })
    const category = await prisma.storageCategory.create({ data: { name: 'Getränke', locationId: location.id, defaultMinQuantity: 2 } })
    await prisma.storageItem.create({ data: { name: 'Milch', quantity: 1, locationId: location.id, categoryId: category.id } })
    await prisma.storageItem.create({ data: { name: 'Wasser', quantity: 12, locationId: location.id, categoryId: category.id } })

    const res = await request(app).get('/api/display/overview').set(displayHeader(token))
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(res.body.countMode).toBe('count')

    expect(res.body.tasks.daily).toHaveLength(1)
    expect(res.body.tasks.daily[0]).toMatchObject({ title: 'Betten machen', timeOfDay: 'morning', difficulty: 1, completed: false, count: 0, completedBy: null })
    expect(res.body.tasks.weekly[0]).toMatchObject({ title: 'Bad putzen', difficulty: 3, completed: false })
    expect(res.body.tasks.monthly).toEqual([])
    expect(res.body.tasks.once).toEqual([])

    expect(res.body.people.find(p => p.id === admin.id)).toMatchObject({ name: 'Tobias', kind: 'account', color: '#2F6FDE', curDay: 0 })
    expect(res.body.people.find(p => p.id === profile.id)).toMatchObject({ name: 'Erik', kind: 'profile', color: '#128A75' })

    expect(res.body.lowStock.map(i => i.name)).toEqual(['Milch'])
  })

  it('gibt keine vertraulichen Nutzerdaten preis', async () => {
    const admin = await createUser({ role: 'admin', email: 'geheim@test.com' })
    const { token } = (await createDisplayToken(admin)).body
    const res = await request(app).get('/api/display/overview').set(displayHeader(token))
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('geheim@test.com')
    expect(body).not.toContain('passwordHash')
    expect(body).not.toContain('"email"')
    expect(body).not.toContain('"role"')
  })
})
