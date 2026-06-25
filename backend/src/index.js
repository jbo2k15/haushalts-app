import 'dotenv/config'
import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import { requireAuth } from './middleware/auth.js'
import { startScheduler } from './services/scheduler.js'
import prisma from './lib/prisma.js'

const app = express()

app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}))
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '100kb' }))

const limiter = (max, windowMs, message) => rateLimit({
  windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false,
})

app.use('/api/auth/login',           limiter(10, 15 * 60 * 1000, 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.'))
app.use('/api/auth/register',        limiter(5,  60 * 60 * 1000, 'Zu viele Registrierungsversuche. Bitte warte eine Stunde.'))
app.use('/api/auth/forgot-password', limiter(5,  60 * 60 * 1000, 'Zu viele Anfragen. Bitte warte eine Stunde.'))
app.use('/api/auth/refresh',         limiter(30, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
app.use('/api/auth/logout',          limiter(20, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))

app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/users', userRoutes)

app.get('/api/vapid-public-key', requireAuth, (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY })
})

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  } catch {
    res.status(503).json({ status: 'error', reason: 'database unavailable' })
  }
})

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err.message)
  }
  res.status(status).json({ error: status >= 500 ? 'Interner Serverfehler' : err.message })
})

startScheduler()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))

async function shutdown() {
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
