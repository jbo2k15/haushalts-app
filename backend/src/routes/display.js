import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { requireDisplay, isDisplayApiEnabled } from '../middleware/display.js'
import * as display from '../domain/display.js'

// Familien-Display. Zwei getrennte Zugangswege in einem Router:
//   - /tokens, /status: Verwaltung der Schluessel durch angemeldete Admins.
//   - alles andere:     das Display selbst, nur mit Display-Schluessel
//                       (requireDisplay) und nur bei DISPLAY_API_ENABLED=true.
const router = Router()

router.get('/status', requireAuth, requireAdmin, async (req, res) => {
  res.json({ enabled: isDisplayApiEnabled() })
})

router.get('/tokens', requireAuth, requireAdmin, async (req, res) => {
  res.json(await display.listTokens())
})

router.post('/tokens', requireAuth, requireAdmin, async (req, res) => {
  const created = await display.createToken(req.body ?? {})
  console.info(`[DISPLAY] Schlüssel angelegt: id=${created.id} von userId=${req.user.id}`)
  res.status(201).json(created)
})

router.delete('/tokens/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await display.deleteToken(req.params.id)
  console.info(`[DISPLAY] Schlüssel gelöscht: id=${req.params.id} von userId=${req.user.id}`)
  res.json(result)
})

router.get('/overview', requireDisplay, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await display.getOverview())
})

export default router
