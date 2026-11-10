import { describe, it, expect } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../src/lib/prisma.js'
import { createApp } from '../../src/app.js'
import authRoutes from '../../src/routes/auth.js'
import taskRoutes from '../../src/routes/tasks.js'
import userRoutes from '../../src/routes/users.js'
import releaseNotesRoutes from '../../src/routes/release-notes.js'
import weatherRoutes from '../../src/routes/weather.js'
import wasteRoutes from '../../src/routes/waste.js'
import storageRoutes from '../../src/routes/storage.js'
import pausesRoutes from '../../src/routes/pauses.js'
import fairnessRoutes from '../../src/routes/fairness.js'

// Rechte-Matrix: JEDE Route der API muss hier bewusst einer Schutzstufe
// zugeordnet sein, und der Test prüft das tatsächliche Verhalten dagegen.
//
//   PUBLIC - ohne Anmeldung erreichbar (nur Anmelde-/Reset-Wege + Health)
//   TICKET - SSE-Stream: Einmal-Ticket statt Bearer-Token
//   USER   - jedes freigeschaltete Haushaltsmitglied
//   ADMIN  - nur Admins
//
// Eine neue Route ohne Eintrag lässt den Test fehlschlagen ("nicht
// klassifiziert") - so kann kein Endpunkt versehentlich ungeschützt oder mit
// zu schwacher Stufe live gehen, ohne dass es jemand entscheidet. Wer hier
// eine Stufe ändert, ändert bewusst die Sicherheitsgrenze der App.
const MATRIX = {
  // ── /api (direkt in app.js) ────────────────────────────────────────────────
  'GET /api/health': 'PUBLIC',
  'GET /api/events': 'TICKET',
  'GET /api/events/ticket': 'USER',
  'GET /api/vapid-public-key': 'USER',

  // ── /api/auth ──────────────────────────────────────────────────────────────
  'GET /api/auth/config': 'PUBLIC',
  'POST /api/auth/register': 'PUBLIC',
  'POST /api/auth/login': 'PUBLIC',
  'POST /api/auth/refresh': 'PUBLIC',
  'POST /api/auth/logout': 'PUBLIC',
  'POST /api/auth/forgot-password': 'PUBLIC',
  'POST /api/auth/reset-password': 'PUBLIC',
  'GET /api/auth/me': 'USER',
  'POST /api/auth/change-password': 'USER',

  // ── /api/tasks ─────────────────────────────────────────────────────────────
  'GET /api/tasks': 'USER',
  'POST /api/tasks/:id/complete': 'USER',
  'POST /api/tasks/:id/uncomplete-last': 'USER',
  'POST /api/tasks/:id/skip': 'USER',
  'GET /api/tasks/log': 'USER',
  'GET /api/tasks/stats': 'USER',
  'GET /api/tasks/admin': 'ADMIN',
  'GET /api/tasks/admin/export': 'ADMIN',
  'POST /api/tasks/admin/import': 'ADMIN',
  'POST /api/tasks/admin': 'ADMIN',
  'PUT /api/tasks/admin/:id': 'ADMIN',
  'DELETE /api/tasks/admin/:id': 'ADMIN',
  'POST /api/tasks/admin/reorder': 'ADMIN',

  // ── /api/users ─────────────────────────────────────────────────────────────
  'PUT /api/users/me': 'USER',
  'PUT /api/users/me/vacation': 'USER',
  'PUT /api/users/me/weather-notifications': 'USER',
  'PUT /api/users/me/swipe-tip-seen': 'USER',
  'GET /api/users/notifications': 'USER',
  'PUT /api/users/notifications': 'USER',
  'PUT /api/users/notifications/global': 'ADMIN',
  'GET /api/users/push-subscription': 'USER',
  'POST /api/users/push-subscription': 'USER',
  'DELETE /api/users/push-subscription': 'USER',
  'GET /api/users': 'ADMIN',
  'POST /api/users/:id/role': 'ADMIN',
  'POST /api/users/:id/approve': 'ADMIN',
  'DELETE /api/users/:id': 'ADMIN',

  // ── /api/release-notes, /api/weather, /api/waste ───────────────────────────
  'GET /api/release-notes': 'USER',
  'PUT /api/release-notes/seen': 'USER',
  'GET /api/weather/status': 'ADMIN',
  'GET /api/waste/status': 'ADMIN',

  // ── /api/storage (Lagerorte: Admin; Kategorien/Artikel: alle) ──────────────
  'GET /api/storage/locations': 'USER',
  'GET /api/storage/low-stock': 'USER',
  'GET /api/storage/autocomplete': 'USER',
  'POST /api/storage/locations': 'ADMIN',
  'PUT /api/storage/locations/:id': 'ADMIN',
  'DELETE /api/storage/locations/:id': 'ADMIN',
  'POST /api/storage/locations/reorder': 'ADMIN',
  'POST /api/storage/locations/:id/categories': 'USER',
  'PUT /api/storage/categories/:id': 'USER',
  'DELETE /api/storage/categories/:id': 'USER',
  'POST /api/storage/locations/:id/categories/reorder': 'USER',
  'POST /api/storage/categories/:id/items': 'USER',
  'PUT /api/storage/items/:id': 'USER',
  'PATCH /api/storage/items/:id/quantity': 'USER',
  'DELETE /api/storage/items/:id': 'USER',
  'POST /api/storage/categories/:id/items/reorder': 'USER',

  // ── /api/pauses ────────────────────────────────────────────────────────────
  'GET /api/pauses/global': 'ADMIN',
  'PUT /api/pauses/global': 'ADMIN',
  'DELETE /api/pauses/global': 'ADMIN',

  // ── /api/fairness ──────────────────────────────────────────────────────────
  'GET /api/fairness/config': 'USER',
  'GET /api/fairness': 'USER',
  'GET /api/fairness/admin/users': 'ADMIN',
  'PUT /api/fairness/admin/users/:id/visibility': 'ADMIN',
  'PUT /api/fairness/admin/settings': 'ADMIN',
  'POST /api/fairness/admin/vacations': 'ADMIN',
  'PUT /api/fairness/admin/vacations/:id': 'ADMIN',
  'DELETE /api/fairness/admin/vacations/:id': 'ADMIN',
}

// Muss app.js entsprechen - wird unten gegen die echte App geprüft.
const MOUNTS = [
  ['/api/auth', authRoutes],
  ['/api/tasks', taskRoutes],
  ['/api/users', userRoutes],
  ['/api/release-notes', releaseNotesRoutes],
  ['/api/weather', weatherRoutes],
  ['/api/waste', wasteRoutes],
  ['/api/storage', storageRoutes],
  ['/api/pauses', pausesRoutes],
  ['/api/fairness', fairnessRoutes],
]

const app = createApp()
const JWT_SECRET = process.env.JWT_SECRET
const DUMMY_ID = '00000000-0000-4000-8000-000000000000'

function routesOf(router, prefix) {
  const out = []
  for (const layer of router.stack) {
    if (!layer.route) continue
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path]
    for (const p of paths) {
      const full = (prefix + p).replace(/\/$/, '') || '/'
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue
        out.push(`${method.toUpperCase()} ${full}`)
      }
    }
  }
  return out
}

function discoverRoutes() {
  return [
    ...routesOf(app.router, ''),
    ...MOUNTS.flatMap(([prefix, router]) => routesOf(router, prefix)),
  ]
}

function authHeader(userId) {
  return { Authorization: `Bearer ${jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' })}` }
}

async function createUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: `matrix-${Math.random().toString(36).slice(2)}@test.com`,
      passwordHash: await bcrypt.hash('Test1234!x', 4),
      name: 'Matrix',
      role: 'user',
      approved: true,
      // Sonst antwortet GET /api/fairness bewusst mit 403 (Freigabe pro Nutzer).
      showFairness: true,
      ...overrides,
    },
  })
}

async function call(key, headers = {}) {
  const [method, rawPath] = key.split(' ')
  const path = rawPath.replace(/:[A-Za-z]+/g, DUMMY_ID)
  const req = request(app)[method.toLowerCase()](path).set(headers)
  // Leerer JSON-Body, damit Handler nicht an req.body === undefined scheitern.
  const res = await (method === 'GET' ? req : req.send({}))
  return res.status
}

const routes = discoverRoutes()
const byLevel = level => routes.filter(r => MATRIX[r] === level)

describe('Rechte-Matrix: Vollständigkeit', () => {
  it('jeder in app.js eingehängte Router ist dem Test bekannt', () => {
    const mounted = app.router.stack.filter(l => !l.route && Array.isArray(l.handle?.stack)).map(l => l.handle)
    expect(mounted.length).toBe(MOUNTS.length)
    for (const [prefix, router] of MOUNTS) {
      expect(mounted.includes(router), `Router für ${prefix} ist nicht in app.js eingehängt`).toBe(true)
    }
  })

  it('findet überhaupt Routen (Schutz gegen eine leere Erkennung)', () => {
    expect(routes.length).toBeGreaterThan(50)
  })

  it('jede Route ist klassifiziert', () => {
    expect(routes.filter(r => !MATRIX[r]), 'Neue Route? In MATRIX bewusst einer Stufe zuordnen.').toEqual([])
  })

  it('die Matrix enthält keine Routen, die es nicht mehr gibt', () => {
    expect(Object.keys(MATRIX).filter(r => !routes.includes(r))).toEqual([])
  })

  it('öffentlich sind genau die erwarteten Routen', () => {
    // Bewusst doppelt gepflegt: eine neue öffentliche Route soll zwei Stellen
    // erfordern und damit nicht "nebenbei" entstehen.
    expect(byLevel('PUBLIC').sort()).toEqual([
      'GET /api/auth/config',
      'GET /api/health',
      'POST /api/auth/forgot-password',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/refresh',
      'POST /api/auth/register',
      'POST /api/auth/reset-password',
    ])
  })
})

describe('Rechte-Matrix: Verhalten', () => {
  it('ohne Token: alle geschützten Routen antworten 401', async () => {
    const wrong = []
    for (const r of [...byLevel('USER'), ...byLevel('ADMIN'), ...byLevel('TICKET')]) {
      const status = await call(r)
      if (status !== 401) wrong.push(`${r} → ${status}`)
    }
    expect(wrong).toEqual([])
  })

  it('nicht freigeschaltetes Konto: alle geschützten Routen antworten 401', async () => {
    const pending = await createUser({ approved: false })
    const wrong = []
    for (const r of [...byLevel('USER'), ...byLevel('ADMIN')]) {
      const status = await call(r, authHeader(pending.id))
      if (status !== 401) wrong.push(`${r} → ${status}`)
    }
    expect(wrong).toEqual([])
  })

  it('offener Passwortwechsel: nur /me und /change-password erreichbar, sonst 403', async () => {
    const user = await createUser({ role: 'admin', mustChangePassword: true })
    const allowed = new Set(['GET /api/auth/me', 'POST /api/auth/change-password'])
    const wrong = []
    for (const r of [...byLevel('USER'), ...byLevel('ADMIN')]) {
      const status = await call(r, authHeader(user.id))
      if (allowed.has(r) ? status === 403 || status === 401 : status !== 403) wrong.push(`${r} → ${status}`)
    }
    expect(wrong).toEqual([])
  })

  it('normales Mitglied: Admin-Routen antworten 403', async () => {
    const user = await createUser()
    const wrong = []
    for (const r of byLevel('ADMIN')) {
      const status = await call(r, authHeader(user.id))
      if (status !== 403) wrong.push(`${r} → ${status}`)
    }
    expect(wrong).toEqual([])
  })

  it('normales Mitglied: Mitglieder-Routen werden nicht mit 401/403 abgewiesen', async () => {
    const user = await createUser()
    const wrong = []
    for (const r of byLevel('USER')) {
      const status = await call(r, authHeader(user.id))
      if (status === 401 || status === 403) wrong.push(`${r} → ${status}`)
    }
    expect(wrong).toEqual([])
  })

  it('SSE-Stream: ein Bearer-Token allein reicht nicht (nur Einmal-Ticket)', async () => {
    const user = await createUser()
    expect(await call('GET /api/events', authHeader(user.id))).toBe(401)
  })
})
