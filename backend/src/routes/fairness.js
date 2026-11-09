import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import * as fairness from '../domain/fairness.js'

// Fairness-Statistik (siehe domain/fairness.js). Mit FAIRNESS_ENABLED=false
// antwortet nur noch /config (enabled: false), alles andere mit 404.
const router = Router()

router.get('/config', requireAuth, (req, res) => {
  const enabled = fairness.isFairnessEnabled()
  res.json({ enabled, canView: enabled && req.user.showFairness === true })
})

router.use((req, res, next) => {
  if (!fairness.isFairnessEnabled()) return res.status(404).json({ error: 'Nicht gefunden' })
  next()
})

router.get('/', requireAuth, async (req, res) => {
  if (!req.user.showFairness) return res.status(403).json({ error: 'Kein Zugriff' })
  res.set('Cache-Control', 'no-cache')
  res.json(await fairness.getFairness())
})

router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  res.json(await fairness.listAdminUsers())
})

router.put('/admin/users/:id/visibility', requireAuth, requireAdmin, async (req, res) => {
  res.json(await fairness.setVisibility(req.params.id, req.body?.showFairness))
})

router.post('/admin/vacations', requireAuth, requireAdmin, async (req, res) => {
  const { userId, startDate, endDate } = req.body || {}
  res.json(await fairness.createVacation({ userId, startDate, endDate }))
})

router.put('/admin/vacations/:id', requireAuth, requireAdmin, async (req, res) => {
  const { startDate, endDate } = req.body || {}
  res.json(await fairness.updateVacation(req.params.id, { startDate, endDate }))
})

router.delete('/admin/vacations/:id', requireAuth, requireAdmin, async (req, res) => {
  res.json(await fairness.deleteVacation(req.params.id))
})

export default router
