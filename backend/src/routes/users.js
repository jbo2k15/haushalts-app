import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { sendApprovalEmail } from '../services/email.js'

const router = Router()

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, approved: true, createdAt: true },
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
  const settings = await prisma.notificationSettings.upsert({
    where: { userId: null },
    update: { dailyTime, weeklyDay, weeklyTime },
    create: { dailyTime, weeklyDay, weeklyTime },
  })
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
