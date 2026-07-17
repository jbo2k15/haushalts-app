import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import userRoutes from './routes/users.js'
import releaseNotesRoutes from './routes/release-notes.js'
import weatherRoutes from './routes/weather.js'
import { requireAuth } from './middleware/auth.js'
import { addSSEClient, removeSSEClient } from './lib/sse.js'
import { issueTicket, consumeTicket } from './lib/sseTickets.js'
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
    // Höher als früher: mehrere Haushaltsmitglieder teilen sich oft dieselbe NAT-IP,
    // dazu kommen 30s-Polling + SSE-Reconnects pro offenem Tab.
    app.use('/api/', limiter(1500, 15 * 60 * 1000, 'Zu viele Anfragen. Bitte warte 15 Minuten.'))
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
  app.use('/api/release-notes', releaseNotesRoutes)
  app.use('/api/weather', weatherRoutes)

  // Kurzlebiges Einmal-Ticket für die SSE-Verbindung ausgeben. requireAuth
  // stellt sicher, dass nur freigeschaltete Nutzer ohne offenen Passwortwechsel
  // ein Ticket erhalten. Das Ticket (statt des Access-Tokens) wandert gleich in
  // die EventSource-URL - siehe Hinweis am /api/events-Handler.
  app.get('/api/events/ticket', requireAuth, (req, res) => {
    res.json({ ticket: issueTicket(req.user.id) })
  })

  app.get('/api/events', async (req, res) => {
    // Auth über ein kurzlebiges Einmal-Ticket im Query-String statt über den
    // Access-Token: EventSource kann keine Header setzen, und Werte in der URL
    // können über Browser-History/Referer/Proxy-Logs leaken. Ein Ticket ist
    // nur ~30 s gültig und einmal einlösbar, minimiert das Leak-Risiko also.
    const userId = consumeTicket(req.query.ticket)
    if (!userId) return res.status(401).end()
    try {
      // Zustand beim Verbindungsaufbau erneut prüfen (das Ticket wurde bis zu
      // 30 s vorher ausgestellt): Freischaltung könnte entzogen oder ein
      // Passwortwechsel erzwungen worden sein.
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || !user.approved) return res.status(401).end()
      if (user.mustChangePassword) return res.status(403).end()
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
    // Body-Parser-/Framework-Fehler (kaputtes JSON, zu großer Body, …) tragen
    // ein err.type und würden sonst interne Meldungen wie "Unexpected token o
    // in JSON at position 1" nach außen geben. Für die geben wir eine generische
    // Meldung zurück; anwendungseigene 4xx-Meldungen bleiben erhalten.
    const isParserError = typeof err.type === 'string'
    const message =
      status >= 500 ? 'Interner Serverfehler'
      : isParserError ? 'Ungültige Anfrage'
      : err.message
    res.status(status).json({ error: message })
  })

  return app
}
