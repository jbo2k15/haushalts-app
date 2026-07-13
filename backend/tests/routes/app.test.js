import { describe, it, expect } from 'vitest'
import request from 'supertest'
import http from 'http'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import { issueTicket } from '../../src/lib/sseTickets.js'

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET

async function createUser(overrides = {}) {
  const passwordHash = await bcrypt.hash('Test1234!x', 4)
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'test@example.com',
      passwordHash,
      name: 'Test User',
      role: 'user',
      approved: true,
      ...overrides,
    },
  })
}

function authHeader(userId) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/health', () => {
  it('meldet ok, solange die Datenbank erreichbar ist', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /api/vapid-public-key', () => {
  it('gibt den öffentlichen VAPID-Schlüssel für authentifizierte Nutzer zurück', async () => {
    const user = await createUser()
    const res = await request(app).get('/api/vapid-public-key').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(res.body.key).toBe(process.env.VAPID_PUBLIC_KEY)
  })

  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/vapid-public-key')
    expect(res.status).toBe(401)
  })
})

describe('Fehlerbehandlung', () => {
  it('gibt bei kaputtem JSON eine generische Meldung zurück (kein Parser-Detail-Leak)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", ')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Ungültige Anfrage')
    // Interne Parser-Meldung darf nicht durchsickern.
    expect(res.body.error).not.toMatch(/JSON|token|position/i)
  })
})

describe('GET /api/events/ticket', () => {
  it('lehnt unauthentifizierte Anfrage ab', async () => {
    const res = await request(app).get('/api/events/ticket')
    expect(res.status).toBe(401)
  })

  it('gibt ein Ticket für einen authentifizierten Nutzer zurück', async () => {
    const user = await createUser({ email: 'ticket@test.com' })
    const res = await request(app).get('/api/events/ticket').set(authHeader(user.id))
    expect(res.status).toBe(200)
    expect(typeof res.body.ticket).toBe('string')
    expect(res.body.ticket.length).toBeGreaterThan(20)
  })
})

describe('GET /api/events (SSE)', () => {
  it('lehnt eine Anfrage ohne Ticket ab', async () => {
    const res = await request(app).get('/api/events')
    expect(res.status).toBe(401)
  })

  it('lehnt eine Anfrage mit ungültigem Ticket ab', async () => {
    const res = await request(app).get('/api/events').query({ ticket: 'ungueltig' })
    expect(res.status).toBe(401)
  })

  it('lehnt ein Ticket ab, dessen Nutzer nicht (mehr) freigeschaltet ist', async () => {
    // Ticket direkt ausstellen (der Endpoint würde einen nicht freigeschalteten
    // Nutzer gar nicht erst durchlassen) und die Prüfung beim Verbindungsaufbau
    // testen: die Freischaltung wird erneut kontrolliert.
    const user = await createUser({ email: 'pending@test.com', approved: false })
    const ticket = issueTicket(user.id)
    const res = await request(app).get('/api/events').query({ ticket })
    expect(res.status).toBe(401)
  })

  it('lehnt die zweite Verwendung desselben Tickets ab (single-use)', async () => {
    const user = await createUser({ email: 'onceonly@test.com' })
    const ticket = issueTicket(user.id)
    // Erste Einlösung öffnet den Stream (Verbindung bleibt offen) - über einen
    // echten Port, danach sofort trennen.
    const server = app.listen(0)
    try {
      const { port } = server.address()
      await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/api/events?ticket=${ticket}`, res => {
          expect(res.statusCode).toBe(200)
          req.destroy()
          resolve()
        })
        req.on('error', () => resolve())
      })
    } finally {
      server.close()
    }
    // Zweite Einlösung desselben Tickets muss scheitern.
    const res = await request(app).get('/api/events').query({ ticket })
    expect(res.status).toBe(401)
  })

  it('öffnet einen event-stream für ein gültiges Ticket', async () => {
    const user = await createUser({ email: 'sse@test.com' })
    const ticketRes = await request(app).get('/api/events/ticket').set(authHeader(user.id))
    const ticket = ticketRes.body.ticket

    // The connection stays open indefinitely (SSE + a 25s keepalive interval),
    // so this can't be driven through supertest's normal request/response
    // buffering - listen on a real ephemeral port and inspect the raw stream
    // instead, destroying the socket once the first chunk confirms it's a
    // live event-stream.
    const server = app.listen(0)
    try {
      const { port } = server.address()
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/events?ticket=${ticket}`, res => {
          expect(res.statusCode).toBe(200)
          expect(res.headers['content-type']).toContain('text/event-stream')
          res.once('data', chunk => {
            expect(chunk.toString()).toContain('event: connected')
            req.destroy()
            resolve()
          })
        })
        req.on('error', () => resolve()) // destroying the socket triggers this - expected
      })
    } finally {
      server.close()
    }
  })
})
