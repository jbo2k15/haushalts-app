import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import * as tasks from '../domain/tasks.js'

const router = Router()

// Die eigentliche Geschäftslogik liegt in domain/tasks.js; die Handler hier
// parsen nur Request-Daten, delegieren und geben das Ergebnis aus. Fehler aus
// der Domäne werden per httpError(status, msg) geworfen und von Express 5
// automatisch an den globalen Error-Handler (app.js) weitergereicht.

// Re-Export, damit bestehende Importe (Tests) von hier aus weiter funktionieren.
export { validateTaskInput } from '../domain/tasks.js'

router.get('/', requireAuth, async (req, res) => {
  const overview = await tasks.getTaskOverview()
  res.set('Cache-Control', 'no-cache')
  res.json(overview)
})

router.post('/:id/complete', requireAuth, async (req, res) => {
  res.json(await tasks.completeTask(req.params.id, { userId: req.user.id, userName: req.user.name }))
})

router.post('/:id/uncomplete-last', requireAuth, async (req, res) => {
  res.json(await tasks.uncompleteLast(req.params.id))
})

router.post('/:id/skip', requireAuth, async (req, res) => {
  res.json(await tasks.skipTask(req.params.id))
})

router.get('/log', requireAuth, async (req, res) => {
  res.json(await tasks.getLog())
})

router.get('/stats', requireAuth, async (req, res) => {
  res.json(await tasks.getStats())
})

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.listAdminTasks())
})

router.get('/admin/export', requireAuth, requireAdmin, async (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="aufgaben.json"')
  res.setHeader('Content-Type', 'application/json')
  res.json(await tasks.exportTasks())
})

router.post('/admin/import', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.importTasks(req.body))
})

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.createTask(req.body))
})

router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.updateTask(req.params.id, req.body))
})

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.deleteTask(req.params.id))
})

router.post('/admin/reorder', requireAuth, requireAdmin, async (req, res) => {
  res.json(await tasks.reorderTasks(req.body))
})

export default router
