import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { getGlobalPause, setGlobalPause, clearGlobalPause } from '../domain/pauses.js'

const router = Router()

router.get('/global', requireAuth, requireAdmin, async (req, res) => {
  res.json(await getGlobalPause())
})

router.put('/global', requireAuth, requireAdmin, async (req, res) => {
  res.json(await setGlobalPause(req.body, req.user.id))
})

router.delete('/global', requireAuth, requireAdmin, async (req, res) => {
  res.json(await clearGlobalPause())
})

export default router
