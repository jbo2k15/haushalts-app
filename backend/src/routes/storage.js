import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import * as storage from '../domain/storage.js'
import { checkLowStockAlerts } from '../services/storage-alerts.js'

const router = Router()
router.use(requireAuth)

// Fire-and-forget: die HTTP-Antwort soll nicht auf den Push-Versand warten
// (siehe storage-alerts.js-Kommentar zum event-getriebenen statt Cron-Ansatz).
function triggerLowStockCheck() {
  checkLowStockAlerts().catch(err => console.error('Vorrat: Fehler beim Knapp-Check:', err.message))
}

router.get('/locations', async (req, res) => {
  res.json(await storage.listLocations())
})

router.get('/low-stock', async (req, res) => {
  res.json(await storage.listLowStockItems())
})

router.get('/autocomplete', async (req, res) => {
  res.json(await storage.listAutocomplete())
})

// ── Lagerorte: Anlegen/Umbenennen/Löschen/Umsortieren ist Admin-only (siehe
// TODO.md "Vorratsschrank-Verwaltung") - strukturelle, für alle sichtbare
// Änderung, analog zu Aufgaben-Definitionen. Mengenpflege bleibt allen offen.
router.post('/locations', requireAdmin, async (req, res) => {
  res.status(201).json(await storage.createLocation(req.body))
})

router.put('/locations/:id', requireAdmin, async (req, res) => {
  res.json(await storage.renameLocation(req.params.id, req.body))
})

router.delete('/locations/:id', requireAdmin, async (req, res) => {
  res.json(await storage.deleteLocation(req.params.id))
})

router.post('/locations/reorder', requireAdmin, async (req, res) => {
  res.json(await storage.reorderLocations(req.body.orderedIds))
})

// ── Kategorien: allen Haushaltsmitgliedern offen ────────────────────────────
router.post('/locations/:id/categories', async (req, res) => {
  res.status(201).json(await storage.createCategory(req.params.id, req.body))
})

router.put('/categories/:id', async (req, res) => {
  res.json(await storage.updateCategory(req.params.id, req.body))
})

router.delete('/categories/:id', async (req, res) => {
  res.json(await storage.deleteCategory(req.params.id))
})

router.post('/locations/:id/categories/reorder', async (req, res) => {
  res.json(await storage.reorderCategories(req.params.id, req.body.orderedIds))
})

// ── Artikel: allen Haushaltsmitgliedern offen ───────────────────────────────
router.post('/categories/:id/items', async (req, res) => {
  const item = await storage.createItem(req.params.id, req.body)
  triggerLowStockCheck()
  res.status(201).json(item)
})

router.put('/items/:id', async (req, res) => {
  const item = await storage.updateItem(req.params.id, req.body)
  triggerLowStockCheck()
  res.json(item)
})

router.patch('/items/:id/quantity', async (req, res) => {
  const item = await storage.setQuantity(req.params.id, req.body.quantity)
  triggerLowStockCheck()
  res.json(item)
})

router.delete('/items/:id', async (req, res) => {
  res.json(await storage.deleteItem(req.params.id))
})

router.post('/categories/:id/items/reorder', async (req, res) => {
  res.json(await storage.reorderItems(req.params.id, req.body.orderedIds))
})

export default router
