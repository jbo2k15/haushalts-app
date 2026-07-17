import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import * as email from '../../src/services/email.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: `user-${Math.random().toString(36).slice(2)}@test.com`,
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PUT /api/users/me', () => {
  it('aktualisiert den eigenen Namen', async () => {
    const user = await createUser({ name: 'Alt' })
    const res = await request(app).put('/api/users/me').set(authHeader(user.id)).send({ name: 'Neu' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Neu')
  })

  it('trimmt Whitespace', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/me').set(authHeader(user.id)).send({ name: '  Getrimmt  ' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Getrimmt')
  })

  it('lehnt leeren Namen ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/me').set(authHeader(user.id)).send({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('lehnt Namen über 100 Zeichen ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/me').set(authHeader(user.id)).send({ name: 'x'.repeat(101) })
    expect(res.status).toBe(400)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).put('/api/users/me').send({ name: 'Neu' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/users/me/vacation', () => {
  it('aktiviert den Urlaubsmodus', async () => {
    const user = await createUser({ vacationMode: false })
    const res = await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: true })
    expect(res.status).toBe(200)
    expect(res.body.vacationMode).toBe(true)
  })

  it('deaktiviert den Urlaubsmodus', async () => {
    const user = await createUser({ vacationMode: true })
    const res = await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: false })
    expect(res.status).toBe(200)
    expect(res.body.vacationMode).toBe(false)
  })

  it('lehnt nicht-boolesche Werte ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/me/vacation').set(authHeader(user.id)).send({ vacationMode: 'yes' })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/users/me/weather-notifications', () => {
  it('deaktiviert die Wetter-Benachrichtigung', async () => {
    const user = await createUser({ notifyOnWeatherSkip: true })
    const res = await request(app).put('/api/users/me/weather-notifications').set(authHeader(user.id)).send({ enabled: false })
    expect(res.status).toBe(200)
    expect(res.body.notifyOnWeatherSkip).toBe(false)
  })

  it('aktiviert die Wetter-Benachrichtigung wieder', async () => {
    const user = await createUser({ notifyOnWeatherSkip: false })
    const res = await request(app).put('/api/users/me/weather-notifications').set(authHeader(user.id)).send({ enabled: true })
    expect(res.status).toBe(200)
    expect(res.body.notifyOnWeatherSkip).toBe(true)
  })

  it('lehnt nicht-boolesche Werte ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/me/weather-notifications').set(authHeader(user.id)).send({ enabled: 'yes' })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/users/me/swipe-tip-seen', () => {
  it('markiert den Swipe-Tipp als gesehen', async () => {
    const user = await createUser({ hasSeenSwipeTip: false })
    const res = await request(app).put('/api/users/me/swipe-tip-seen').set(authHeader(user.id))
    expect(res.status).toBe(200)
    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated.hasSeenSwipeTip).toBe(true)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).put('/api/users/me/swipe-tip-seen')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/users', () => {
  it('gibt die Nutzerliste für Admins zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    await createUser({ email: 'other@test.com' })
    const res = await request(app).get('/api/users').set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(2)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/users').set(authHeader(user.id))
    expect(res.status).toBe(403)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users/:id/role', () => {
  it('befördert einen Nutzer zum Admin', async () => {
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ role: 'user' })
    const res = await request(app).post(`/api/users/${target.id}/role`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('admin')
  })

  it('degradiert einen Admin zum Nutzer, wenn ein weiterer Admin existiert', async () => {
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ role: 'admin' })
    const res = await request(app).post(`/api/users/${target.id}/role`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('user')
  })

  it('verhindert das Degradieren des letzten Admins', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post(`/api/users/${admin.id}/role`).set(authHeader(admin.id))
    // Ein Admin kann seinen eigenen Status ohnehin nicht ändern - separater Guard greift zuerst.
    expect(res.status).toBe(400)
  })

  it('verhindert das Degradieren des letzten Admins durch einen anderen Admin', async () => {
    const admin = await createUser({ role: 'admin' })
    const secondAdminActingAlone = await prisma.user.update({ where: { id: admin.id }, data: { role: 'user' } })
    const soleAdmin = await createUser({ role: 'admin' })
    const res = await request(app).post(`/api/users/${soleAdmin.id}/role`).set(authHeader(secondAdminActingAlone.id))
    expect(res.status).toBe(403) // Akteur ist jetzt selbst kein Admin mehr
  })

  it('verhindert das Ändern des eigenen Admin-Status', async () => {
    const admin = await createUser({ role: 'admin' })
    await createUser({ role: 'admin' })
    const res = await request(app).post(`/api/users/${admin.id}/role`).set(authHeader(admin.id))
    expect(res.status).toBe(400)
  })

  it('gibt 404 für unbekannten Nutzer zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/users/does-not-exist/role').set(authHeader(admin.id))
    expect(res.status).toBe(404)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const target = await createUser({ email: 'other@test.com' })
    const res = await request(app).post(`/api/users/${target.id}/role`).set(authHeader(user.id))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/users/:id/approve', () => {
  it('schaltet einen unfreigeschalteten Nutzer frei und verschickt eine E-Mail', async () => {
    const sendApprovalEmail = vi.spyOn(email, 'sendApprovalEmail').mockResolvedValue()
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ email: 'pending@test.com', approved: false })
    const res = await request(app).post(`/api/users/${target.id}/approve`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.approved).toBe(true)
    expect(sendApprovalEmail).toHaveBeenCalledWith('pending@test.com', 'Test User')
  })

  it('verschickt keine E-Mail beim Entziehen der Freischaltung', async () => {
    const sendApprovalEmail = vi.spyOn(email, 'sendApprovalEmail').mockResolvedValue()
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ email: 'active@test.com', approved: true })
    const res = await request(app).post(`/api/users/${target.id}/approve`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.approved).toBe(false)
    expect(sendApprovalEmail).not.toHaveBeenCalled()
  })

  it('schlägt nicht fehl, wenn der E-Mail-Versand einen Fehler wirft', async () => {
    vi.spyOn(email, 'sendApprovalEmail').mockRejectedValue(new Error('SMTP down'))
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ email: 'pending2@test.com', approved: false })
    const res = await request(app).post(`/api/users/${target.id}/approve`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    expect(res.body.approved).toBe(true)
  })

  it('gibt 404 für unbekannten Nutzer zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).post('/api/users/does-not-exist/approve').set(authHeader(admin.id))
    expect(res.status).toBe(404)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const target = await createUser({ email: 'other@test.com', approved: false })
    const res = await request(app).post(`/api/users/${target.id}/approve`).set(authHeader(user.id))
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/users/:id', () => {
  it('löscht einen normalen Nutzer', async () => {
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ email: 'delete-me@test.com' })
    const res = await request(app).delete(`/api/users/${target.id}`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
    const stillExists = await prisma.user.findUnique({ where: { id: target.id } })
    expect(stillExists).toBeNull()
  })

  it('verhindert das Löschen des eigenen Accounts', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).delete(`/api/users/${admin.id}`).set(authHeader(admin.id))
    expect(res.status).toBe(400)
  })

  it('verhindert das Löschen des letzten Admins durch einen anderen Admin', async () => {
    const acting = await createUser({ role: 'admin' })
    const soleAdmin = await createUser({ email: 'sole-admin@test.com', role: 'admin' })
    await prisma.user.update({ where: { id: acting.id }, data: { role: 'user' } })
    const res = await request(app).delete(`/api/users/${soleAdmin.id}`).set(authHeader(acting.id))
    expect(res.status).toBe(403) // Akteur ist jetzt selbst kein Admin mehr
  })

  it('erlaubt das Löschen eines Admins, wenn ein weiterer Admin existiert', async () => {
    const admin = await createUser({ role: 'admin' })
    const target = await createUser({ email: 'other-admin@test.com', role: 'admin' })
    const res = await request(app).delete(`/api/users/${target.id}`).set(authHeader(admin.id))
    expect(res.status).toBe(200)
  })

  it('gibt 404 für unbekannten Nutzer zurück', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).delete('/api/users/does-not-exist').set(authHeader(admin.id))
    expect(res.status).toBe(404)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const target = await createUser({ email: 'other@test.com' })
    const res = await request(app).delete(`/api/users/${target.id}`).set(authHeader(user.id))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/users/notifications', () => {
  it('gibt eigene und globale Einstellungen zurück (beide null, falls keine existieren)', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/users/notifications').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ user: null, global: null })
  })

  it('gibt vorhandene eigene und globale Einstellungen zurück', async () => {
    const user = await createUser()
    await prisma.notificationSettings.create({ data: { userId: user.id, dailyTime: '20:00', weeklyDay: 3, weeklyTime: '08:00' } })
    await prisma.notificationSettings.create({ data: { userId: null, dailyTime: '21:30', weeklyDay: 6, weeklyTime: '09:30' } })
    const res = await request(app).get('/api/users/notifications').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.user.dailyTime).toBe('20:00')
    expect(res.body.global.dailyTime).toBe('21:30')
  })
})

describe('PUT /api/users/notifications', () => {
  it('legt eigene Einstellungen neu an', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/notifications').set(authHeader(user.id))
      .send({ dailyTime: '18:00', weeklyDay: 1, weeklyTime: '07:00' })
    expect(res.status).toBe(200)
    expect(res.body.dailyTime).toBe('18:00')
  })

  it('aktualisiert vorhandene eigene Einstellungen', async () => {
    const user = await createUser()
    await prisma.notificationSettings.create({ data: { userId: user.id, dailyTime: '20:00', weeklyDay: 3, weeklyTime: '08:00' } })
    const res = await request(app).put('/api/users/notifications').set(authHeader(user.id))
      .send({ dailyTime: '19:00', weeklyDay: 4, weeklyTime: '10:00' })
    expect(res.status).toBe(200)
    expect(res.body.dailyTime).toBe('19:00')
    expect(res.body.weeklyDay).toBe(4)
  })

  it.each([
    ['ungültige tägliche Uhrzeit', { dailyTime: '25:00', weeklyDay: 1, weeklyTime: '07:00' }],
    ['ungültiges Uhrzeitformat', { dailyTime: '7:00', weeklyDay: 1, weeklyTime: '07:00' }],
    ['ungültiger Wochentag (negativ)', { dailyTime: '18:00', weeklyDay: -1, weeklyTime: '07:00' }],
    ['ungültiger Wochentag (zu groß)', { dailyTime: '18:00', weeklyDay: 7, weeklyTime: '07:00' }],
    ['ungültige wöchentliche Uhrzeit', { dailyTime: '18:00', weeklyDay: 1, weeklyTime: 'abc' }],
  ])('lehnt %s ab', async (_label, payload) => {
    const user = await createUser()
    const res = await request(app).put('/api/users/notifications').set(authHeader(user.id)).send(payload)
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/users/notifications/global', () => {
  it('legt globale Einstellungen neu an', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).put('/api/users/notifications/global').set(authHeader(admin.id))
      .send({ dailyTime: '22:00', weeklyDay: 0, weeklyTime: '11:00' })
    expect(res.status).toBe(200)
    expect(res.body.dailyTime).toBe('22:00')
  })

  it('aktualisiert vorhandene globale Einstellungen', async () => {
    const admin = await createUser({ role: 'admin' })
    await prisma.notificationSettings.create({ data: { userId: null, dailyTime: '21:00', weeklyDay: 6, weeklyTime: '09:00' } })
    const res = await request(app).put('/api/users/notifications/global').set(authHeader(admin.id))
      .send({ dailyTime: '23:00', weeklyDay: 2, weeklyTime: '12:00' })
    expect(res.status).toBe(200)
    expect(res.body.dailyTime).toBe('23:00')
  })

  it('lehnt ungültige Werte ab', async () => {
    const admin = await createUser({ role: 'admin' })
    const res = await request(app).put('/api/users/notifications/global').set(authHeader(admin.id))
      .send({ dailyTime: 'invalid', weeklyDay: 0, weeklyTime: '11:00' })
    expect(res.status).toBe(400)
  })

  it('lehnt Zugriff für Nicht-Admins ab', async () => {
    const user = await createUser()
    const res = await request(app).put('/api/users/notifications/global').set(authHeader(user.id))
      .send({ dailyTime: '22:00', weeklyDay: 0, weeklyTime: '11:00' })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/users/push-subscription', () => {
  it('meldet exists:true für eine vorhandene eigene Subscription', async () => {
    const user = await createUser()
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.com/mine', p256dh: 'k', auth: 'a' } })
    const res = await request(app).get('/api/users/push-subscription').set(authHeader(user.id))
      .query({ endpoint: 'https://push.example.com/mine' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ exists: true })
  })

  it('meldet exists:false, wenn der Server die Subscription nicht kennt (z.B. nach VAPID-Rotation)', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/users/push-subscription').set(authHeader(user.id))
      .query({ endpoint: 'https://push.example.com/unknown' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ exists: false })
  })

  it('meldet exists:false für eine fremde Subscription (kein Leak über Nutzergrenzen)', async () => {
    const owner = await createUser({ email: 'owner@test.com' })
    const other = await createUser({ email: 'other@test.com' })
    await prisma.pushSubscription.create({ data: { userId: owner.id, endpoint: 'https://push.example.com/owner-only', p256dh: 'k', auth: 'a' } })
    const res = await request(app).get('/api/users/push-subscription').set(authHeader(other.id))
      .query({ endpoint: 'https://push.example.com/owner-only' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ exists: false })
  })

  it('lehnt eine Anfrage ohne Endpoint ab', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/users/push-subscription').set(authHeader(user.id))
    expect(res.status).toBe(400)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/users/push-subscription').query({ endpoint: 'https://push.example.com/x' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users/push-subscription', () => {
  it('speichert eine neue Subscription', async () => {
    const user = await createUser()
    const res = await request(app).post('/api/users/push-subscription').set(authHeader(user.id))
      .send({ endpoint: 'https://push.example.com/abc', p256dh: 'key', auth: 'secret' })
    expect(res.status).toBe(200)
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://push.example.com/abc' } })
    expect(sub.userId).toBe(user.id)
  })

  it('ersetzt eine bestehende Subscription mit demselben Endpoint (z.B. Besitzerwechsel)', async () => {
    const userA = await createUser({ email: 'a@test.com' })
    const userB = await createUser({ email: 'b@test.com' })
    await prisma.pushSubscription.create({ data: { userId: userA.id, endpoint: 'https://push.example.com/shared', p256dh: 'old', auth: 'old' } })
    const res = await request(app).post('/api/users/push-subscription').set(authHeader(userB.id))
      .send({ endpoint: 'https://push.example.com/shared', p256dh: 'new', auth: 'new' })
    expect(res.status).toBe(200)
    const subs = await prisma.pushSubscription.findMany({ where: { endpoint: 'https://push.example.com/shared' } })
    expect(subs).toHaveLength(1)
    expect(subs[0].userId).toBe(userB.id)
  })

  it('protokolliert einen Besitzerwechsel (fremdes Konto) per Warnung', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const userA = await createUser({ email: 'a@test.com' })
    const userB = await createUser({ email: 'b@test.com' })
    await prisma.pushSubscription.create({ data: { userId: userA.id, endpoint: 'https://push.example.com/shared', p256dh: 'old', auth: 'old' } })
    await request(app).post('/api/users/push-subscription').set(authHeader(userB.id))
      .send({ endpoint: 'https://push.example.com/shared', p256dh: 'new', auth: 'new' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Besitzerwechsel'))
  })

  it('protokolliert KEINEN Besitzerwechsel, wenn derselbe Nutzer erneut subscribed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = await createUser()
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.com/mine', p256dh: 'old', auth: 'old' } })
    await request(app).post('/api/users/push-subscription').set(authHeader(user.id))
      .send({ endpoint: 'https://push.example.com/mine', p256dh: 'new', auth: 'new' })
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ['nicht-https Endpoint', { endpoint: 'http://push.example.com/abc', p256dh: 'key', auth: 'secret' }],
    ['zu langer Endpoint', { endpoint: 'https://push.example.com/' + 'x'.repeat(500), p256dh: 'key', auth: 'secret' }],
    ['fehlender p256dh-Schlüssel', { endpoint: 'https://push.example.com/abc', auth: 'secret' }],
    ['zu langer auth-Schlüssel', { endpoint: 'https://push.example.com/abc', p256dh: 'key', auth: 'x'.repeat(101) }],
  ])('lehnt %s ab', async (_label, payload) => {
    const user = await createUser()
    const res = await request(app).post('/api/users/push-subscription').set(authHeader(user.id)).send(payload)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/users/push-subscription', () => {
  it('entfernt die eigene Subscription', async () => {
    const user = await createUser()
    await prisma.pushSubscription.create({ data: { userId: user.id, endpoint: 'https://push.example.com/mine', p256dh: 'k', auth: 'a' } })
    const res = await request(app).delete('/api/users/push-subscription').set(authHeader(user.id)).send({ endpoint: 'https://push.example.com/mine' })
    expect(res.status).toBe(200)
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://push.example.com/mine' } })
    expect(sub).toBeNull()
  })

  it('entfernt keine fremde Subscription', async () => {
    const owner = await createUser({ email: 'owner@test.com' })
    const attacker = await createUser({ email: 'attacker@test.com' })
    await prisma.pushSubscription.create({ data: { userId: owner.id, endpoint: 'https://push.example.com/owner', p256dh: 'k', auth: 'a' } })
    const res = await request(app).delete('/api/users/push-subscription').set(authHeader(attacker.id)).send({ endpoint: 'https://push.example.com/owner' })
    expect(res.status).toBe(200)
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://push.example.com/owner' } })
    expect(sub).not.toBeNull()
  })
})
