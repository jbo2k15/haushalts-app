import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID, createHash } from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../services/email.js'

const router = Router()

const BCRYPT_ROUNDS = 12
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const COOKIE_NAME = 'refresh_token'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: SEVEN_DAYS_MS,
  path: '/api/auth',
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email)
}

function validatePassword(pw) {
  if (!pw || pw.length < 10) return 'Passwort muss mindestens 10 Zeichen haben'
  if (pw.length > 64) return 'Passwort darf maximal 64 Zeichen haben'
  if (!/[A-Z]/.test(pw)) return 'Passwort muss mindestens einen Großbuchstaben enthalten'
  if (!/[a-z]/.test(pw)) return 'Passwort muss mindestens einen Kleinbuchstaben enthalten'
  if (!/[0-9]/.test(pw)) return 'Passwort muss mindestens eine Zahl enthalten'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Passwort muss mindestens ein Sonderzeichen enthalten'
  return null
}

function signAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' })
}

async function issueRefreshToken(userId, res) {
  await prisma.refreshToken.deleteMany({ where: { userId } })
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS)
  await prisma.refreshToken.create({ data: { userId, token: hashToken(token), expiresAt } })
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Alle Felder sind erforderlich' })
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' })
  if (name.trim().length === 0 || name.length > 100) return res.status(400).json({ error: 'Name muss zwischen 1 und 100 Zeichen lang sein' })
  const pwError = validatePassword(password)
  if (pwError) return res.status(400).json({ error: pwError })

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return res.status(409).json({ error: 'E-Mail bereits registriert' })

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'user', approved: false },
  })

  res.json({ message: 'Registrierung erfolgreich. Warte auf Freischaltung durch einen Admin.' })
})

// Dummy hash for timing-safe login (prevents user enumeration via response time)
const DUMMY_HASH = await bcrypt.hash('dummy-timing-protection', BCRYPT_ROUNDS)

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(401).json({ error: 'Ungültige Anmeldedaten' })
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  // Always run bcrypt compare to prevent timing-based user enumeration
  const hash = user?.passwordHash ?? DUMMY_HASH
  const valid = await bcrypt.compare(password ?? '', hash)

  if (!user || !valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' })
  if (!user.approved) return res.status(403).json({ error: 'Dein Account wurde noch nicht freigeschaltet' })

  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
  await issueRefreshToken(user.id, res)
  const accessToken = signAccessToken(user.id)

  res.json({
    token: accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword, vacationMode: user.vacationMode },
  })
})

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Kein Refresh-Token' })

  const stored = await prisma.refreshToken.findUnique({ where: { token: hashToken(token) } })
  if (!stored || new Date() > stored.expiresAt) {
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' })
    return res.status(401).json({ error: 'Session abgelaufen' })
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } })
  if (!user || !user.approved) {
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' })
    return res.status(401).json({ error: 'Nicht autorisiert' })
  }

  await issueRefreshToken(user.id, res)
  const accessToken = signAccessToken(user.id)

  res.json({
    token: accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword, vacationMode: user.vacationMode },
  })
})

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token: hashToken(token) } })
  }
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' })
  res.json({ message: 'Abgemeldet' })
})

router.get('/me', requireAuth, async (req, res) => {
  const { id, email, name, role, mustChangePassword } = req.user
  res.json({ id, email, name, role, mustChangePassword })
})

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Aktuelles Passwort fehlt' })
  }
  const pwError = validatePassword(newPassword)
  if (pwError) return res.status(400).json({ error: pwError })

  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' })

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash, mustChangePassword: false } })
  await prisma.refreshToken.deleteMany({ where: { userId: req.user.id } })
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' })

  res.json({ message: 'Passwort geändert' })
})

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' })

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return res.json({ message: 'Falls die E-Mail existiert, wurde ein Link gesendet.' })

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  await prisma.passwordResetToken.create({ data: { userId: user.id, token: hashToken(token), expiresAt } })

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, user.name, resetLink)

  res.json({ message: 'Falls die E-Mail existiert, wurde ein Link gesendet.' })
})

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body
  const pwErr = validatePassword(newPassword)
  if (pwErr) return res.status(400).json({ error: pwErr })

  const hashedToken = hashToken(token)
  // Atomic claim: mark used before any other work to prevent race-condition double-use
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { token: hashedToken, used: false, expiresAt: { gt: new Date() } },
    data: { used: true },
  })
  if (claimed.count === 0) {
    return res.status(400).json({ error: 'Link ungültig oder abgelaufen' })
  }
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: hashedToken } })

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash, mustChangePassword: false } })
  await prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } })
  await prisma.passwordResetToken.delete({ where: { token: hashedToken } })

  res.json({ message: 'Passwort erfolgreich geändert' })
})

export default router
