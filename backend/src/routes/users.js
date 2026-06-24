import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { sendApprovalEmail } from '../services/email.js'

const router = Router()

router.put('/me', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name darf nicht leer sein' })
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name: name.trim() },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true },
  })
  res.json(updated)
})

router.post('/:id/role', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params
  if (id === req.user.id) return res.status(400).json({ error: 'Du kannst deinen eigenen Admin-Status nicht ändern' })

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' })

  if (target.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) return res.status(400).json({ error: 'Es muss mindestens ein Admin vorhanden sein' })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: target.role === 'admin' ? 'user' : 'admin' },
    select: { id: true, name: true, role: true },
  })
  res.json(updated)
})

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, approved: true, createdAt: true, lastActiveAt: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(users)
})

router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' })

  const wasApproved = user.approved
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { approved: !user.approved },
    select: { id: true, email: true, name: true, approved: true },
  })

  if (!wasApproved && updated.approved) {
    try { await sendApprovalEmail(updated.email, updated.name) } catch {}
  }

  res.json(updated)
})

router.get('/notifications', requireAuth, async (req, res) => {
  const settings = await prisma.notificationSettings.findUnique({ where: { userId: req.user.id } })
  const global = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  res.json({ user: settings, global })
})

router.put('/notifications', requireAuth, async (req, res) => {
  const { dailyTime, weeklyDay, weeklyTime } = req.body
  const settings = await prisma.notificationSettings.upsert({
    where: { userId: req.user.id },
    update: { dailyTime, weeklyDay, weeklyTime },
    create: { userId: req.user.id, dailyTime, weeklyDay, weeklyTime },
  })
  res.json(settings)
})

router.put('/notifications/global', requireAuth, requireAdmin, async (req, res) => {
  const { dailyTime, weeklyDay, weeklyTime } = req.body
  const existing = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const settings = existing
    ? await prisma.notificationSettings.update({ where: { id: existing.id }, data: { dailyTime, weeklyDay, weeklyTime } })
    : await prisma.notificationSettings.create({ data: { dailyTime, weeklyDay, weeklyTime } })
  res.json(settings)
})

router.post('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint, p256dh, auth } = req.body
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth, userId: req.user.id },
    create: { userId: req.user.id, endpoint, p256dh, auth },
  })
  res.json({ message: 'Subscription gespeichert' })
})

router.delete('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint } = req.body
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } })
  res.json({ message: 'Subscription entfernt' })
})

export default router
