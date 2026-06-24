import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../services/email.js'

const router = Router()

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Alle Felder sind erforderlich' })
  if (password.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' })

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return res.status(409).json({ error: 'E-Mail bereits registriert' })

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, role: 'user', approved: false },
  })

  res.json({ message: 'Registrierung erfolgreich. Warte auf Freischaltung durch einen Admin.' })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() } })
  if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' })
  if (!user.approved) return res.status(403).json({ error: 'Dein Account wurde noch nicht freigeschaltet' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' })

  const token = signToken(user.id)
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
  })
})

router.get('/me', requireAuth, async (req, res) => {
  const { id, email, name, role, mustChangePassword } = req.user
  res.json({ id, email, name, role, mustChangePassword })
})

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' })

  const valid = await bcrypt.compare(currentPassword, req.user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' })

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash, mustChangePassword: false } })

  res.json({ message: 'Passwort geändert' })
})

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase() } })
  if (!user) return res.json({ message: 'Falls die E-Mail existiert, wurde ein Link gesendet.' })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, user.name, resetLink)

  res.json({ message: 'Falls die E-Mail existiert, wurde ein Link gesendet.' })
})

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' })

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
    return res.status(400).json({ error: 'Link ungültig oder abgelaufen' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash, mustChangePassword: false } })
  await prisma.passwordResetToken.update({ where: { token }, data: { used: true } })

  res.json({ message: 'Passwort erfolgreich geändert' })
})

export default router
