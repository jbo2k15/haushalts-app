import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import { requireAuth } from './middleware/auth.js'
import { addSSEClient, removeSSEClient } from './lib/sse.js'
import prisma from './lib/prisma.js'

export function createApp() {
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

  // Rate limiting — disabled in tests to avoid interference
  if (process.env.NODE_ENV !== 'test') {
    const limiter = (max, windowMs, message) => rateLimit({
      windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false,
    })
    app.use('/api/', limiter(300, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
    app.use('/api/auth/login',           limiter(10, 15 * 60 * 1000, 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.'))
    app.use('/api/auth/register',        limiter(5,  60 * 60 * 1000, 'Zu viele Registrierungsversuche. Bitte warte eine Stunde.'))
    app.use('/api/auth/forgot-password', limiter(5,  60 * 60 * 1000, 'Zu viele Anfragen. Bitte warte eine Stunde.'))
    app.use('/api/auth/reset-password',  limiter(5,  15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
    app.use('/api/auth/change-password', limiter(5,  15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
    app.use('/api/auth/refresh',         limiter(30, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
    app.use('/api/auth/logout',          limiter(20, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
  }

  app.use('/api/auth', authRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/users', userRoutes)

  app.get('/api/events', async (req, res) => {
    const token = req.query.token
    if (!token) return res.status(401).end()
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user || !user.approved) return res.status(401).end()
    } catch {
      return res.status(401).end()
    }
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.flushHeaders()
    res.write('event: connected\ndata: {}\n\n')
    addSSEClient(res)
    const keepalive = setInterval(() => { try { res.write(': keepalive\n\n') } catch { clearInterval(keepalive) } }, 25000)
    req.on('close', () => { clearInterval(keepalive); removeSSEClient(res) })
  })

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
    if (status >= 500) console.error(`${req.method} ${req.path} →`, err.message)
    res.status(status).json({ error: status >= 500 ? 'Interner Serverfehler' : err.message })
  })

  return app
}
