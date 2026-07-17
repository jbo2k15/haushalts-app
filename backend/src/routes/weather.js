import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { getWeatherStatus } from '../services/weather.js'

const router = Router()

router.get('/status', requireAuth, requireAdmin, async (req, res) => {
  res.json(await getWeatherStatus())
})

export default router
