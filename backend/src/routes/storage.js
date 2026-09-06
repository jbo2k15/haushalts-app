import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import * as storage from '../domain/storage.js'

const router = Router()
router.use(requireAuth)

router.get('/locations', async (req, res) => {
  res.json(await storage.listLocations())
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
  res.status(201).json(await storage.createItem(req.params.id, req.body))
})

router.put('/items/:id', async (req, res) => {
  res.json(await storage.updateItem(req.params.id, req.body))
})

router.patch('/items/:id/quantity', async (req, res) => {
  res.json(await storage.setQuantity(req.params.id, req.body.quantity))
})

router.delete('/items/:id', async (req, res) => {
  res.json(await storage.deleteItem(req.params.id))
})

router.post('/categories/:id/items/reorder', async (req, res) => {
  res.json(await storage.reorderItems(req.params.id, req.body.orderedIds))
})

export default router
