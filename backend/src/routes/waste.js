import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { getWasteSyncStatus } from '../services/waste-calendar.js'

const router = Router()

router.get('/status', requireAuth, requireAdmin, async (req, res) => {
  res.json(await getWasteSyncStatus())
})

export default router
