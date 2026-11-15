import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { getFairness, listAdminUsers } from '../../src/domain/fairness.js'

// Familien-Display, Etappe 2: Profile (Personen ohne Anmeldung) und Farben.
const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `p-${Math.random().toString(36).slice(2)}@test.com`,
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

async function createProfile(admin, body = { name: 'Mia', color: '#128a75' }) {
  return request(app).post('/api/users/profiles').set(authHeader(admin.id)).send(body)
}

describe('POST /api/users/profiles', () => {
  it('legt ein Profil ohne Anmeldung an', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await createProfile(admin)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Mia', kind: 'profile', color: '#128A75', approved: true })
    expect(res.body.email).toBeUndefined()
    expect(res.body.passwordHash).toBeUndefined()

    const stored = await prisma.user.findUnique({ where: { id: res.body.id } })
    expect(stored.email).toMatch(/@profil\.invalid$/)
    expect(stored.role).toBe('user')
  })

  it('erlaubt ein Profil ohne Farbe', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await createProfile(admin, { name: 'Ben' })
    expect(res.status).toBe(201)
    expect(res.body.color).toBeNull()
  })

  it('lehnt leeren Namen und ungültige Farbe ab', async () => {
    const admin = await createUser({ role: 'admin' })
    expect((await createProfile(admin, { name: '  ' })).status).toBe(400)
    expect((await createProfile(admin, { name: 'x'.repeat(101) })).status).toBe(400)
    expect((await createProfile(admin, { name: 'Mia', color: 'grün' })).status).toBe(400)
    expect((await createProfile(admin, { name: 'Mia', color: '#12' })).status).toBe(400)
    expect((await createProfile(admin, { name: { a: 1 } })).status).toBe(400)
  })

  it('ist Admins vorbehalten', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/users/profiles').set(authHeader(user.id)).send({ name: 'Mia' })
    expect(res.status).toBe(403)
  })
})

describe('Profile können sich nicht anmelden', () => {
  it('Login mit der Platzhalter-Adresse schlägt fehl und zählt keinen Lockout', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const stored = await prisma.user.findUnique({ where: { id: profile.id } })
    for (const password of ['!', '', 'Test1234!x']) {
      const res = await request(app).post('/api/auth/login').send({ email: stored.email, password })
      expect(res.status).toBe(401)
    }
    const after = await prisma.user.findUnique({ where: { id: profile.id } })
    expect(after.failedLoginAttempts).toBe(0)
    expect(after.lockedUntil).toBeNull()
  })

  it('ein für ein Profil signiertes Token wird abgewiesen', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const res = await request(app).get('/api/tasks').set(authHeader(profile.id))
    expect(res.status).toBe(401)
  })

  it('ein Refresh-Token für ein Profil wird abgewiesen', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const { createHash } = await import('crypto')
    await prisma.refreshToken.create({
      data: { userId: profile.id, token: createHash('sha256').update('profil-token').digest('hex'), expiresAt: new Date(Date.now() + 60000) },
    })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=profil-token')
    expect(res.status).toBe(401)
  })

  it('Passwort-Reset legt für ein Profil kein Token an', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const stored = await prisma.user.findUnique({ where: { id: profile.id } })
    const res = await request(app).post('/api/auth/forgot-password').send({ email: stored.email })
    expect(res.status).toBe(200)
    expect(await prisma.passwordResetToken.count({ where: { userId: profile.id } })).toBe(0)
  })
})

describe('Profile in der Nutzerverwaltung', () => {
  it('GET /api/users liefert Art und Farbe', async () => {
    const admin = await createUser({ role: 'admin' })
    await createProfile(admin)
    const res = await request(app).get('/api/users').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.find(u => u.name === 'Mia')).toMatchObject({ kind: 'profile', color: '#128A75' })
    expect(res.body.find(u => u.id === admin.id)).toMatchObject({ kind: 'account', color: null })
  })

  it('ein Profil kann weder Admin werden noch gesperrt werden', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    expect((await request(app).post(`/api/users/${profile.id}/role`).set(authHeader(admin.id))).status).toBe(400)
    expect((await request(app).post(`/api/users/${profile.id}/approve`).set(authHeader(admin.id))).status).toBe(400)
    const stored = await prisma.user.findUnique({ where: { id: profile.id } })
    expect(stored.role).toBe('user')
    expect(stored.approved).toBe(true)
  })

  it('ein Profil kann umbenannt und gelöscht werden', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const renamed = await request(app).put(`/api/users/profiles/${profile.id}`).set(authHeader(admin.id)).send({ name: 'Mia S.', color: '#8A4CC2' })
    expect(renamed.status).toBe(200)
    expect(renamed.body).toMatchObject({ name: 'Mia S.', color: '#8A4CC2' })

    const deleted = await request(app).delete(`/api/users/${profile.id}`).set(authHeader(admin.id))
    expect(deleted.status).toBe(200)
    expect(await prisma.user.findUnique({ where: { id: profile.id } })).toBeNull()
  })

  it('PUT /profiles/:id ändert keine Konten', async () => {
    const admin = await createUser({ role: 'admin' })
    const account = await createUser({ name: 'Konto' })
    const res = await request(app).put(`/api/users/profiles/${account.id}`).set(authHeader(admin.id)).send({ name: 'Gekapert' })
    expect(res.status).toBe(404)
    expect((await prisma.user.findUnique({ where: { id: account.id } })).name).toBe('Konto')
  })
})

describe('PUT /api/users/:id/color', () => {
  it('setzt und entfernt die Farbe eines Kontos', async () => {
    const admin = await createUser({ role: 'admin' })
    const set = await request(app).put(`/api/users/${admin.id}/color`).set(authHeader(admin.id)).send({ color: '#2f6fde' })
    expect(set.status).toBe(200)
    expect(set.body.color).toBe('#2F6FDE')
    const cleared = await request(app).put(`/api/users/${admin.id}/color`).set(authHeader(admin.id)).send({ color: null })
    expect(cleared.body.color).toBeNull()
  })

  it('lehnt ungültige Farben und unbekannte Nutzer ab', async () => {
    const admin = await createUser({ role: 'admin' })
    expect((await request(app).put(`/api/users/${admin.id}/color`).set(authHeader(admin.id)).send({ color: 'rot' })).status).toBe(400)
    expect((await request(app).put('/api/users/00000000-0000-4000-8000-000000000000/color').set(authHeader(admin.id)).send({ color: '#FFFFFF' })).status).toBe(404)
  })

  it('ist Admins vorbehalten', async () => {
    const user = await createUser()
    expect((await request(app).put(`/api/users/${user.id}/color`).set(authHeader(user.id)).send({ color: '#FFFFFF' })).status).toBe(403)
  })
})

describe('Profile in Statistik und Fairness', () => {
  it('erscheinen in der Rangliste mit Art und Farbe', async () => {
    const admin = await createUser({ role: 'admin' })
    const profile = (await createProfile(admin)).body
    const res = await request(app).get('/api/tasks/stats').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.find(s => s.id === profile.id)).toMatchObject({ kind: 'profile', color: '#128A75', curDay: 0 })
    expect(res.body.find(s => s.id === admin.id)).toMatchObject({ kind: 'account' })
  })

  it('zählen nicht in der Fairness-Statistik und ihrer Verwaltung', async () => {
    const admin = await createUser({ role: 'admin', name: 'Admin' })
    const profile = (await createProfile(admin)).body
    await prisma.taskLog.create({
      data: { taskTitle: 'Tisch decken', taskType: 'daily', status: 'completed', completedBy: profile.id, userName: 'Mia', forDate: '2026-11-15' },
    })
    const fairness = await getFairness()
    expect(JSON.stringify(fairness)).not.toContain(profile.id)
    const adminUsers = await listAdminUsers()
    expect(adminUsers.map(u => u.id)).toEqual([admin.id])
  })
})
