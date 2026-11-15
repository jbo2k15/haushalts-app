import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { requireDisplay, isDisplayApiEnabled } from '../middleware/display.js'
import * as display from '../domain/display.js'
import { checkLowStockAlerts } from '../services/storage-alerts.js'

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

router.get('/storage', requireDisplay, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(await display.getStorageOverview())
})

// ── Schreibzugriffe des Displays (bewusst nur diese vier) ────────────────────
router.post('/tasks/:id/complete', requireDisplay, async (req, res) => {
  res.json(await display.completeFromDisplay(req.params.id, req.body ?? {}))
})

router.post('/tasks/:id/uncomplete-last', requireDisplay, async (req, res) => {
  res.json(await display.uncompleteLastFromDisplay(req.params.id))
})

router.post('/storage/items/:id/restock', requireDisplay, async (req, res) => {
  const item = await display.restockFromDisplay(req.params.id, req.body ?? {})
  // Wie in routes/storage.js: Knapp-Status nachziehen, ohne die Antwort
  // darauf warten zu lassen.
  checkLowStockAlerts().catch(err => console.error('Vorrat: Fehler beim Knapp-Check:', err.message))
  res.json(item)
})

// Bestand erhoehen ODER verringern (delta positiv/negativ) - fuer die
// Vorrats-Uebersicht am Display. /restock bleibt als reines Auffuellen bestehen.
router.post('/storage/items/:id/adjust', requireDisplay, async (req, res) => {
  const item = await display.adjustFromDisplay(req.params.id, req.body ?? {})
  checkLowStockAlerts().catch(err => console.error('Vorrat: Fehler beim Knapp-Check:', err.message))
  res.json(item)
})

export default router
