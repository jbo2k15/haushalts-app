import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'

const app = createApp()

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'test@example.com',
      passwordHash: overrides.passwordHash ?? passwordHash,
      name: overrides.name ?? 'Test User',
      role: overrides.role ?? 'user',
      approved: overrides.approved ?? true,
      ...overrides,
    },
  })
}

describe('POST /api/auth/login', () => {
  it('meldet gültige Credentials an und gibt Token zurück', async () => {
    await createUser({ email: 'login@test.com' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Test1234!x' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.email).toBe('login@test.com')
  })

  it('lehnt falsches Passwort ab', async () => {
    await createUser({ email: 'wrong@test.com' })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'WrongPass1!' })
    expect(res.status).toBe(401)
  })

  it('lehnt unbekannte E-Mail ab', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Test1234!x' })
    expect(res.status).toBe(401)
  })

  it('lehnt nicht freigeschalteten Account ab', async () => {
    await createUser({ email: 'pending@test.com', approved: false })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pending@test.com', password: 'Test1234!x' })
    expect(res.status).toBe(403)
  })

  it('lehnt leeren Body ab', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/register', () => {
  it('registriert einen neuen Nutzer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'Sicher1234!', name: 'Neu' })
    expect(res.status).toBe(200)
    expect(res.body.message).toContain('Registrierung')
  })

  it('lehnt doppelte E-Mail ab', async () => {
    await createUser({ email: 'dup@test.com' })
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Sicher1234!', name: 'Neu' })
    expect(res.status).toBe(409)
  })

  it('lehnt schwaches Passwort ab', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'weak@test.com', password: 'schwach', name: 'Test' })
    expect(res.status).toBe(400)
  })

  it('lehnt zu langen Namen ab', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'long@test.com', password: 'Sicher1234!', name: 'x'.repeat(101) })
    expect(res.status).toBe(400)
  })
})

describe('Geschützte Routen', () => {
  it('lehnt Anfrage ohne Token ab', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(401)
  })

  it('lehnt Anfrage mit ungültigem Token ab', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer ungueltig')
    expect(res.status).toBe(401)
  })
})
