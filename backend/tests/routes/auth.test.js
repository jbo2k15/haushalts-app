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
