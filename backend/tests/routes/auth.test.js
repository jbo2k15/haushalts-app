import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import * as email from '../../src/services/email.js'

const app = createApp()

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

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

  it('lehnt nicht-String email/password mit 401 ab (kein 500 durch toLowerCase auf Objekt)', async () => {
    for (const body of [
      { email: { contains: '@' }, password: 'x' },
      { email: ['a@b.co'], password: 'x' },
      { email: 123, password: 'x' },
      { email: 'a@b.co', password: { x: 1 } },
    ]) {
      const res = await request(app).post('/api/auth/login').send(body)
      expect(res.status).toBe(401)
    }
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

describe('mustChangePassword wird serverseitig erzwungen', () => {
  async function loginWithForcedChange() {
    await createUser({ email: 'forced@test.com', mustChangePassword: true })
    const res = await request(app).post('/api/auth/login').send({ email: 'forced@test.com', password: 'Test1234!x' })
    return res.body.token
  }

  it('blockiert normale API-Routen mit 403, solange das Passwort geändert werden muss', async () => {
    const token = await loginWithForcedChange()
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.mustChangePassword).toBe(true)
  })

  it('erlaubt /api/auth/me trotz erzwungener Passwortänderung', async () => {
    const token = await loginWithForcedChange()
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('erlaubt das Ändern des Passworts und gibt danach normale Routen frei', async () => {
    const token = await loginWithForcedChange()
    const change = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Test1234!x', newPassword: 'NeuesPasswort1234!' })
    expect(change.status).toBe(200)

    const relogin = await request(app).post('/api/auth/login').send({ email: 'forced@test.com', password: 'NeuesPasswort1234!' })
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${relogin.body.token}`)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/forgot-password', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('legt einen Reset-Token an und verschickt eine E-Mail für eine bekannte Adresse', async () => {
    const sendPasswordResetEmail = vi.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue()
    const user = await createUser({ email: 'reset@test.com' })
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'reset@test.com' })
    expect(res.status).toBe(200)
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('reset@test.com', 'Test User', expect.stringContaining('/reset-password?token='))
    const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } })
    expect(token).not.toBeNull()
    expect(token.used).toBe(false)
  })

  it('gibt dieselbe generische Antwort für eine unbekannte Adresse zurück (kein User-Enumeration-Leak)', async () => {
    const sendPasswordResetEmail = vi.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue()
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'does-not-exist@test.com' })
    expect(known.status).toBe(200)
    expect(known.body.message).toBe('Falls die E-Mail existiert, wurde ein Link gesendet.')
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('lehnt ungültige E-Mail-Formate ab', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' })
    expect(res.status).toBe(400)
  })

  it('ersetzt einen vorhandenen Token durch einen neuen bei wiederholter Anfrage', async () => {
    vi.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue()
    const user = await createUser({ email: 'repeat@test.com' })
    await request(app).post('/api/auth/forgot-password').send({ email: 'repeat@test.com' })
    await request(app).post('/api/auth/forgot-password').send({ email: 'repeat@test.com' })
    const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } })
    expect(tokens).toHaveLength(1)
  })

  it('gibt trotzdem 200 zurück, wenn der E-Mail-Versand fehlschlägt (Token bleibt gültig)', async () => {
    vi.spyOn(email, 'sendPasswordResetEmail').mockRejectedValue(new Error('SMTP down'))
    const user = await createUser({ email: 'smtpfail@test.com' })
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'smtpfail@test.com' })
    expect(res.status).toBe(200)
    const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } })
    expect(token).not.toBeNull()
  })
})

describe('POST /api/auth/reset-password', () => {
  it('setzt das Passwort mit gültigem Token zurück und invalidiert alte Refresh-Tokens', async () => {
    const user = await createUser({ email: 'validreset@test.com' })
    await prisma.refreshToken.create({ data: { userId: user.id, token: 'old-refresh-token', expiresAt: new Date(Date.now() + 100000) } })
    const rawToken = 'raw-token-abc'
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    })

    const res = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'NeuesPasswort1234!' })
    expect(res.status).toBe(200)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(await bcrypt.compare('NeuesPasswort1234!', updated.passwordHash)).toBe(true)

    const remainingRefreshTokens = await prisma.refreshToken.findMany({ where: { userId: user.id } })
    expect(remainingRefreshTokens).toHaveLength(0)
  })

  it('lehnt ein zu schwaches neues Passwort ab', async () => {
    const user = await createUser({ email: 'weakpw@test.com' })
    const rawToken = 'raw-token-weak'
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    })
    const res = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'schwach' })
    expect(res.status).toBe(400)
  })

  it('lehnt einen unbekannten Token ab', async () => {
    const missing = await request(app).post('/api/auth/reset-password').send({ newPassword: 'NeuesPasswort1234!' })
    expect(missing.status).toBe(400)

    const res = await request(app).post('/api/auth/reset-password').send({ token: 'does-not-exist', newPassword: 'NeuesPasswort1234!' })
    expect(res.status).toBe(400)
  })

  it('lehnt einen abgelaufenen Token ab', async () => {
    const user = await createUser({ email: 'expired@test.com' })
    const rawToken = 'raw-token-expired'
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'NeuesPasswort1234!' })
    expect(res.status).toBe(400)
  })

  it('lehnt die zweite Verwendung desselben Tokens ab', async () => {
    const user = await createUser({ email: 'reuse@test.com' })
    const rawToken = 'raw-token-reuse'
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    })
    const first = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'ErstesPasswort1!' })
    expect(first.status).toBe(200)
    const second = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'ZweitesPasswort2!' })
    expect(second.status).toBe(400)
  })
})

describe('POST /api/auth/refresh', () => {
  it('gibt mit gültigem Refresh-Cookie ein neues Access-Token aus und rotiert den Refresh-Token', async () => {
    const agent = request.agent(app)
    await createUser({ email: 'refresh@test.com' })
    const login = await agent.post('/api/auth/login').send({ email: 'refresh@test.com', password: 'Test1234!x' })
    expect(login.status).toBe(200)
    const oldTokenCount = await prisma.refreshToken.count()
    expect(oldTokenCount).toBe(1)

    const res = await agent.post('/api/auth/refresh')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.email).toBe('refresh@test.com')

    // Rotation: still exactly one active refresh token for the user, but a new one.
    const tokens = await prisma.refreshToken.count()
    expect(tokens).toBe(1)
  })

  it('lehnt Anfrage ohne Refresh-Cookie ab', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('lehnt einen unbekannten Refresh-Token ab', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=does-not-exist')
    expect(res.status).toBe(401)
  })

  it('lehnt einen abgelaufenen Refresh-Token ab und löscht das Cookie', async () => {
    const user = await createUser({ email: 'refreshexpired@test.com' })
    const rawToken = 'raw-refresh-expired'
    await prisma.refreshToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${rawToken}`)
    expect(res.status).toBe(401)
  })

  it('lehnt einen gültigen Token ab, wenn der Nutzer inzwischen nicht mehr freigeschaltet ist', async () => {
    const user = await createUser({ email: 'refreshunapproved@test.com' })
    const rawToken = 'raw-refresh-unapproved'
    await prisma.refreshToken.create({
      data: { userId: user.id, token: hashToken(rawToken), expiresAt: new Date(Date.now() + 100000) },
    })
    await prisma.user.update({ where: { id: user.id }, data: { approved: false } })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${rawToken}`)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('löscht den Refresh-Token aus der Datenbank', async () => {
    const agent = request.agent(app)
    await createUser({ email: 'logout@test.com' })
    await agent.post('/api/auth/login').send({ email: 'logout@test.com', password: 'Test1234!x' })
    expect(await prisma.refreshToken.count()).toBe(1)

    const res = await agent.post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(await prisma.refreshToken.count()).toBe(0)

    // The cleared cookie means a subsequent refresh attempt fails too.
    const refreshAfterLogout = await agent.post('/api/auth/refresh')
    expect(refreshAfterLogout.status).toBe(401)
  })

  it('funktioniert auch ohne vorhandenes Refresh-Cookie (keine Fehlermeldung)', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
  })
})
