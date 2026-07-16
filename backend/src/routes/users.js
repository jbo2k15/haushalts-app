import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { sendApprovalEmail } from '../services/email.js'

const router = Router()

router.put('/me', requireAuth, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name darf nicht leer sein' })
  if (name.trim().length > 100) return res.status(400).json({ error: 'Name darf maximal 100 Zeichen haben' })
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name: name.trim() },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, vacationMode: true },
  })
  res.json(updated)
})

router.put('/me/vacation', requireAuth, async (req, res) => {
  const { vacationMode } = req.body
  if (typeof vacationMode !== 'boolean') return res.status(400).json({ error: 'Ungültiger Wert' })
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { vacationMode },
    select: { id: true, email: true, name: true, role: true, mustChangePassword: true, vacationMode: true },
  })
  res.json(updated)
})

// Marks the one-time "swipe between pages" onboarding tip as seen - stored
// server-side (not localStorage) so it stays dismissed across devices, same
// approach as lastSeenVersion for release notes.
router.put('/me/swipe-tip-seen', requireAuth, async (req, res) => {
  await prisma.user.update({ where: { id: req.user.id }, data: { hasSeenSwipeTip: true } })
  res.json({ message: 'Gespeichert' })
})

// Alle Routen mit literalem Pfad muessen vor den generischen /:id-Routen
// registriert werden - sonst faengt z.B. DELETE /:id einen Aufruf wie
// DELETE /push-subscription mit id="push-subscription" ab und verlangt
// faelschlich Admin-Rechte (requireAdmin auf /:id) statt der eigentlichen
// requireAuth-only-Logik der Ziel-Route.
router.get('/notifications', requireAuth, async (req, res) => {
  const settings = await prisma.notificationSettings.findUnique({ where: { userId: req.user.id } })
  const global = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  res.json({ user: settings, global })
})

function isValidTime(t) {
  if (typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function validateNotificationSettings({ dailyTime, weeklyDay, weeklyTime }) {
  if (!isValidTime(dailyTime)) return 'Ungültige tägliche Uhrzeit'
  if (!Number.isInteger(weeklyDay) || weeklyDay < 0 || weeklyDay > 6) return 'Ungültiger Wochentag'
  if (!isValidTime(weeklyTime)) return 'Ungültige wöchentliche Uhrzeit'
  return null
}

router.put('/notifications', requireAuth, async (req, res) => {
  const { dailyTime, weeklyDay, weeklyTime } = req.body
  const err = validateNotificationSettings({ dailyTime, weeklyDay, weeklyTime })
  if (err) return res.status(400).json({ error: err })
  const settings = await prisma.notificationSettings.upsert({
    where: { userId: req.user.id },
    update: { dailyTime, weeklyDay, weeklyTime },
    create: { userId: req.user.id, dailyTime, weeklyDay, weeklyTime },
  })
  res.json(settings)
})

router.put('/notifications/global', requireAuth, requireAdmin, async (req, res) => {
  const { dailyTime, weeklyDay, weeklyTime } = req.body
  const err = validateNotificationSettings({ dailyTime, weeklyDay, weeklyTime })
  if (err) return res.status(400).json({ error: err })
  const existing = await prisma.notificationSettings.findFirst({ where: { userId: null } })
  const settings = existing
    ? await prisma.notificationSettings.update({ where: { id: existing.id }, data: { dailyTime, weeklyDay, weeklyTime } })
    : await prisma.notificationSettings.create({ data: { dailyTime, weeklyDay, weeklyTime } })
  res.json(settings)
})

router.get('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint } = req.query
  if (typeof endpoint !== 'string' || !endpoint) return res.status(400).json({ error: 'Ungültiger Endpoint' })
  const sub = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.user.id } })
  res.json({ exists: !!sub })
})

router.post('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint, p256dh, auth } = req.body
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 500)
    return res.status(400).json({ error: 'Ungültiger Endpoint' })
  if (typeof p256dh !== 'string' || p256dh.length > 200)
    return res.status(400).json({ error: 'Ungültiger p256dh-Schlüssel' })
  if (typeof auth !== 'string' || auth.length > 100)
    return res.status(400).json({ error: 'Ungültiger Auth-Schlüssel' })
  // endpoint ist global eindeutig (eine Push-Subscription pro Browser). upsert
  // statt blindem deleteMany({ endpoint }) + create: übernimmt/aktualisiert
  // denselben Endpoint atomar für den aktuellen Nutzer (z. B. Besitzerwechsel
  // auf einem geteilten Gerät), ohne ungescoptes Löschen und ohne
  // Unique-Constraint-Konflikt.
  //
  // Gehört der Endpoint bereits einem ANDEREN Konto, ist der Besitzerwechsel
  // weiterhin erlaubt, wird aber protokolliert - eine unerwartete Übernahme
  // (Angreifer kennt einen fremden, geheimen Endpoint) soll nachvollziehbar
  // sein, statt still zu passieren. Nur Endpoint-Suffix loggen, nicht den
  // vollständigen geheimen Endpoint.
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } })
  if (existing && existing.userId !== req.user.id) {
    console.warn(`[Push] Endpoint-Besitzerwechsel: ...${endpoint.slice(-12)} von userId=${existing.userId} -> userId=${req.user.id}`)
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.user.id, p256dh, auth },
    create: { userId: req.user.id, endpoint, p256dh, auth },
  })
  res.json({ message: 'Subscription gespeichert' })
})

router.delete('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint } = req.body
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } })
  res.json({ message: 'Subscription entfernt' })
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

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params
  if (id === req.user.id) return res.status(400).json({ error: 'Du kannst deinen eigenen Account nicht löschen' })

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return res.status(404).json({ error: 'Nutzer nicht gefunden' })

  if (target.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) return res.status(400).json({ error: 'Es muss mindestens ein Admin vorhanden sein' })
  }

  await prisma.user.delete({ where: { id } })
  res.json({ message: 'Nutzer gelöscht' })
})

export default router
