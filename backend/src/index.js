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
app.use(express.json())

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Interner Serverfehler' })
})

startScheduler()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`))
